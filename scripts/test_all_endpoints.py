"""Full end-to-end API test against live BusIQ backend."""
import requests
import json
import sys

BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"

results = []

def test(name, url, checks=None):
    try:
        r = requests.get(url, timeout=15)
        ok = r.status_code == 200
        data = r.json() if ok else None
        detail = ""
        if ok and checks:
            for check_name, check_fn in checks.items():
                try:
                    result = check_fn(data)
                    detail += f"  {check_name}: {result}\n"
                except Exception as e:
                    detail += f"  {check_name}: FAIL ({e})\n"
                    ok = False
        status = "PASS" if ok else f"FAIL ({r.status_code})"
        results.append((name, status))
        print(f"{'PASS' if ok else 'FAIL':4} {name}")
        if detail:
            print(detail.rstrip())
    except Exception as e:
        results.append((name, f"ERROR: {e}"))
        print(f"ERR  {name}: {e}")

print("=" * 60)
print("  BUSIQ END-TO-END API VERIFICATION")
print("=" * 60)
print()

# Core
test("Health check", f"{BASE}/healthz",
     {"status": lambda d: d.get("status")})

# Fleet
test("Fleet snapshot", f"{API}/buses",
     {"count": lambda d: d["data"]["count"],
      "has_vehicles": lambda d: len(d["data"]["vehicles"]) > 0})

# Routes
test("Route list", f"{API}/routes",
     {"count": lambda d: len(d["data"])})

test("Route shapes", f"{API}/routes/shapes",
     {"features": lambda d: len(d["features"])})

test("Route stops", f"{API}/routes/stops",
     {"features": lambda d: len(d["features"])})

# Predictions
# Predictions overview is POST-only, skip in GET test

test("Ghost buses", f"{API}/predictions/ghosts",
     {"ghost_count": lambda d: d["data"]["summary"]["total_ghost_vehicles"],
      "dead_routes": lambda d: d["data"]["summary"]["total_routes_without_buses"]})

test("Bunching", f"{API}/predictions/bunching",
     {"pairs": lambda d: d["data"]["summary"]["total_pairs"],
      "routes": lambda d: d["data"]["summary"]["routes_affected"]})

# Operations
test("Network health", f"{API}/ops/health",
     {"score": lambda d: d["data"]["score"],
      "grade": lambda d: d["data"]["grade"]})

test("Interventions", f"{API}/ops/interventions",
     {"count": lambda d: len(d["data"]["interventions"]),
      "sample": lambda d: d["data"]["interventions"][0]["headline"] if d["data"]["interventions"] else "none"})

test("Intervention history", f"{API}/ops/interventions/history",
     {"type": lambda d: type(d).__name__})

# Crowding
test("Crowding snapshot", f"{API}/crowding/snapshot",
     {"type": lambda d: type(d["data"]).__name__})

test("Crowding recent", f"{API}/crowding/recent",
     {"type": lambda d: type(d["data"]).__name__})

# Journey
test("Journey stops", f"{API}/journey/stops",
     {"count": lambda d: len(d.get("data", d.get("stops", [])))})

# Multimodal
test("Dublin Bikes", f"{API}/journey/bikes",
     {"stations": lambda d: len(d.get("data", d.get("stations", [])))})

# Insights
test("Insights", f"{API}/insights",
     {"vehicles": lambda d: d["live"]["total_vehicles"],
      "on_time_pct": lambda d: d["live"]["on_time_pct"],
      "ghost_rate": lambda d: d["live"]["ghost_rate_pct"]})

# Summary
print()
print("=" * 60)
passed = sum(1 for _, s in results if s == "PASS")
total = len(results)
print(f"  RESULTS: {passed}/{total} passed")
if passed < total:
    print("  FAILURES:")
    for name, status in results:
        if status != "PASS":
            print(f"    {name}: {status}")
print("=" * 60)

sys.exit(0 if passed == total else 1)
