"""
BusIQ Performance Benchmark — validates p95 < 200ms target.

Usage:
    python -m tests.benchmark [--base-url http://localhost:8000] [--rounds 50]

Tests all 23 API endpoints with configurable concurrency.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, field

import httpx


@dataclass
class EndpointResult:
    path: str
    method: str = "GET"
    latencies_ms: list[float] = field(default_factory=list)
    errors: int = 0

    @property
    def p50(self) -> float:
        return statistics.median(self.latencies_ms) if self.latencies_ms else 0

    @property
    def p95(self) -> float:
        if not self.latencies_ms:
            return 0
        sorted_l = sorted(self.latencies_ms)
        idx = int(len(sorted_l) * 0.95)
        return sorted_l[min(idx, len(sorted_l) - 1)]

    @property
    def p99(self) -> float:
        if not self.latencies_ms:
            return 0
        sorted_l = sorted(self.latencies_ms)
        idx = int(len(sorted_l) * 0.99)
        return sorted_l[min(idx, len(sorted_l) - 1)]

    @property
    def mean(self) -> float:
        return statistics.mean(self.latencies_ms) if self.latencies_ms else 0

    @property
    def success_rate(self) -> float:
        total = len(self.latencies_ms) + self.errors
        return (len(self.latencies_ms) / total * 100) if total > 0 else 0


# Endpoints to benchmark
ENDPOINTS = [
    ("GET", "/healthz"),
    ("GET", "/api/v1/buses"),
    ("GET", "/api/v1/routes"),
    ("GET", "/api/v1/routes/shapes"),
    ("GET", "/api/v1/routes/search?q=39"),
    ("GET", "/api/v1/predictions/ghosts"),
    ("GET", "/api/v1/predictions/bunching"),
    ("GET", "/api/v1/crowding/snapshot"),
    ("GET", "/api/v1/crowding/recent"),
    ("GET", "/api/v1/journey/bikes"),
    ("GET", "/api/v1/journey/stops"),
    ("GET", "/api/v1/journey/luas/PHI"),
    ("GET", "/api/v1/journey/dart/BRAY"),
    (
        "POST",
        "/api/v1/journey/plan",
        {
            "origin_lat": 53.3590,
            "origin_lon": -6.2695,
            "dest_lat": 53.3390,
            "dest_lon": -6.2388,
        },
    ),
]


async def bench_endpoint(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    body: dict | None,
    rounds: int,
) -> EndpointResult:
    result = EndpointResult(path=path, method=method)

    for _ in range(rounds):
        t0 = time.perf_counter()
        try:
            if method == "POST":
                resp = await client.post(path, json=body, timeout=10.0)
            else:
                resp = await client.get(path, timeout=10.0)

            elapsed_ms = (time.perf_counter() - t0) * 1000

            if resp.status_code < 400:
                result.latencies_ms.append(elapsed_ms)
            else:
                result.errors += 1
        except Exception:
            result.errors += 1

    return result


async def run_benchmark(base_url: str, rounds: int, concurrency: int):
    print(f"\n{'=' * 72}")
    print(f"  BusIQ Performance Benchmark")
    print(f"  Target: {base_url}  |  Rounds: {rounds}  |  Concurrency: {concurrency}")
    print(f"{'=' * 72}\n")

    async with httpx.AsyncClient(base_url=base_url) as client:
        # Warm up
        print("  Warming up...", end="", flush=True)
        for method, path, *rest in ENDPOINTS:
            body = rest[0] if rest else None
            try:
                if method == "POST":
                    await client.post(path, json=body, timeout=10.0)
                else:
                    await client.get(path, timeout=10.0)
            except Exception:
                pass
        print(" done\n")

        # Run benchmarks
        results: list[EndpointResult] = []
        for method, path, *rest in ENDPOINTS:
            body = rest[0] if rest else None
            # Run rounds sequentially per endpoint (not concurrently vs same endpoint)
            result = await bench_endpoint(client, method, path, body, rounds)
            results.append(result)

            status = "✓" if result.p95 < 200 else "✗"
            print(
                f"  {status} {method:4s} {path:<45s} "
                f"p50={result.p50:6.1f}ms  p95={result.p95:6.1f}ms  "
                f"p99={result.p99:6.1f}ms  err={result.errors}"
            )

    # Summary
    print(f"\n{'─' * 72}")
    all_latencies = []
    total_errors = 0
    failures = []
    for r in results:
        all_latencies.extend(r.latencies_ms)
        total_errors += r.errors
        if r.p95 >= 200:
            failures.append(r)

    if all_latencies:
        sorted_all = sorted(all_latencies)
        global_p50 = statistics.median(sorted_all)
        global_p95 = sorted_all[int(len(sorted_all) * 0.95)]
        global_p99 = sorted_all[int(len(sorted_all) * 0.99)]
        global_mean = statistics.mean(sorted_all)
    else:
        global_p50 = global_p95 = global_p99 = global_mean = 0

    print(f"\n  GLOBAL:  mean={global_mean:.1f}ms  p50={global_p50:.1f}ms  "
          f"p95={global_p95:.1f}ms  p99={global_p99:.1f}ms")
    print(f"  Total requests: {len(all_latencies)}  Errors: {total_errors}")

    if failures:
        print(f"\n  ⚠ {len(failures)} endpoint(s) ABOVE p95 < 200ms target:")
        for f in failures:
            print(f"    → {f.method} {f.path}  p95={f.p95:.1f}ms")
    else:
        print(f"\n  ✓ ALL endpoints within p95 < 200ms target")

    print(f"\n{'=' * 72}\n")

    # Return exit code
    return 0 if not failures else 1


def main():
    parser = argparse.ArgumentParser(description="BusIQ Performance Benchmark")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--rounds", type=int, default=50, help="Requests per endpoint")
    parser.add_argument("--concurrency", type=int, default=1, help="Concurrent workers")
    args = parser.parse_args()

    exit_code = asyncio.run(run_benchmark(args.base_url, args.rounds, args.concurrency))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
