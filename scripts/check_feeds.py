"""Check which GTFS feeds contain route mappings for operators in the NTA GTFS-RT."""
import httpx, zipfile, io, csv, asyncio

async def check():
    urls = [
        "https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip",
        "https://www.transportforireland.ie/transitData/Data/GTFS_Bus_Eireann.zip",
    ]
    async with httpx.AsyncClient(timeout=60.0) as client:
        for url in urls:
            resp = await client.get(url, follow_redirects=True)
            zf = zipfile.ZipFile(io.BytesIO(resp.content))
            fname = url.split("/")[-1]
            print(f"\n{fname}:")
            print(f"  Files: {zf.namelist()[:10]}")
            if "routes.txt" in zf.namelist():
                with zf.open("routes.txt") as f:
                    reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                    routes = {}
                    for row in reader:
                        rid = row.get("route_id", "").strip()
                        name = row.get("route_short_name", "").strip()
                        if rid:
                            routes[rid] = name
                    prefixes = set(r.split("_")[0] for r in routes)
                    print(f"  Route count: {len(routes)}")
                    print(f"  Prefixes: {sorted(prefixes)[:15]}")
                    # Show samples of 5399 and 5249
                    for prefix in ["5399", "5249"]:
                        samples = [(r, n) for r, n in routes.items() if r.startswith(prefix)]
                        if samples:
                            print(f"  {prefix} samples ({len(samples)} routes):")
                            for rid, name in samples[:5]:
                                print(f"    {rid} -> {name}")

asyncio.run(check())
