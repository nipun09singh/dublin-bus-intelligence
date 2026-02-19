"""Collect killer stats from live BusIQ API for submission evidence."""
import json
import requests
from datetime import datetime

BASE = "http://localhost:8000/api/v1"

def collect():
    stats = {"timestamp": datetime.now().isoformat()}
    
    # Ghost buses
    r = requests.get(f"{BASE}/predictions/ghosts", timeout=15)
    g = r.json()["data"]
    stats["ghost_buses"] = len(g["ghost_buses"])
    summary = g.get("summary", {})
    stats["total_live_vehicles"] = summary.get("total_live_vehicles", 0)
    stats["total_ghost_vehicles"] = summary.get("total_ghost_vehicles", 0)
    stats["ghost_routes"] = len(g.get("ghost_routes", []))
    stats["ghost_route_names"] = [gr["route_short_name"] for gr in g.get("ghost_routes", [])[:20]]
    
    # Bunching
    r2 = requests.get(f"{BASE}/predictions/bunching", timeout=15)
    b = r2.json()["data"]
    b_summary = b.get("summary", {})
    alerts = b.get("alerts", [])
    stats["bunching_pairs"] = b_summary.get("total_pairs", 0)
    stats["bunching_routes"] = b_summary.get("routes_affected", 0)
    stats["bunching_severe"] = sum(1 for a in alerts if a.get("severity") == "severe")
    routes = set(a["route_short_name"] for a in alerts if a.get("route_short_name"))
    stats["bunching_route_names"] = sorted(routes)
    
    # Interventions
    r3 = requests.get(f"{BASE}/ops/interventions", timeout=15)
    j3_data = r3.json()["data"]
    interventions = j3_data.get("interventions", []) if isinstance(j3_data, dict) else j3_data
    stats["active_interventions"] = len(interventions)
    stats["intervention_types"] = {}
    for i in interventions:
        t = i["type"]
        stats["intervention_types"][t] = stats["intervention_types"].get(t, 0) + 1
    stats["sample_interventions"] = [
        {
            "type": i["type"],
            "priority": i.get("priority", "?"),
            "route": i.get("route_name", "?"),
            "stop": i.get("target_stop", "?"),
            "reason": i.get("description", "?")[:120]
        }
        for i in interventions[:10]
    ]
    
    # Network health
    r4 = requests.get(f"{BASE}/ops/health", timeout=15)
    h = r4.json()["data"]
    stats["network_health_score"] = h.get("score")
    stats["health_grade"] = h.get("grade")
    stats["health_components"] = h.get("components", {})
    
    # Insights
    r5 = requests.get(f"{BASE}/insights", timeout=15)
    live = r5.json()["live"]
    stats["fleet_size"] = live["total_vehicles"]
    stats["active_routes"] = live["active_routes"]
    stats["on_time_pct"] = live["on_time_pct"]
    stats["avg_delay_seconds"] = live["avg_delay_seconds"]
    stats["ghost_rate_pct"] = live["ghost_rate_pct"]
    stats["severe_delay_count"] = live["severe_delay"]
    stats["top_delayed"] = live["top_delayed_routes"][:5]
    stats["hour"] = live["hour"]
    stats["weekday"] = live["weekday"]
    
    return stats

if __name__ == "__main__":
    stats = collect()
    
    print("=" * 60)
    print("  BUSIQ KILLER STATS - LIVE SNAPSHOT")
    print(f"  {stats['weekday']} {stats['hour']}:00 | {stats['timestamp'][:19]}")
    print("=" * 60)
    print()
    print(f"  FLEET:  {stats['fleet_size']} vehicles across {stats['active_routes']} routes")
    print(f"  PUNCTUALITY:  Only {stats['on_time_pct']}% on time | Avg delay {stats['avg_delay_seconds']/60:.1f} min")
    print(f"  GHOST BUSES:  {stats['total_ghost_vehicles']} signal-lost ({stats['ghost_rate_pct']}% of fleet)")
    print(f"  DEAD ROUTES:  {stats['ghost_routes']} routes with zero live buses")
    print(f"  BUNCHING:  {stats['bunching_pairs']} pairs across {stats['bunching_routes']} routes ({stats['bunching_severe']} severe)")
    print(f"  NETWORK HEALTH:  {stats['network_health_score']}/100 (Grade: {stats['health_grade']})")
    print(f"  INTERVENTIONS:  {stats['active_interventions']} active — {stats['intervention_types']}")
    print()
    print("  TOP 5 WORST ROUTES:")
    for td in stats["top_delayed"]:
        print(f"    Route {td['route']:>5} | {td['avg_delay']/60:.0f} min avg delay | {td['vehicles']} buses")
    print()
    print("  SAMPLE INTERVENTIONS:")
    for si in stats["sample_interventions"][:5]:
        print(f"    {si['type']:8} P{si['priority']} | Route {si['route']} → {si['stop']}")
        print(f"             {si['reason']}")
    print()
    
    # Save to file
    with open("data/killer_stats.json", "w") as f:
        json.dump(stats, f, indent=2)
    print("  Saved to data/killer_stats.json")
