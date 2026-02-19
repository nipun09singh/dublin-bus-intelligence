# BusIQ — Submission for Dublin Bus Innovation Challenge

> **One platform. Four pillars. Built on data Dublin Bus already has.**

---

## Executive Summary

**BusIQ** transforms Dublin Bus's existing GTFS and GTFS-RT data into a real-time predictive intelligence platform spanning all four Dublin Bus Innovation pillars. In a single dark-canvas interface — the **Nerve Centre** — judges see Dublin's 1,000+ buses breathe across the city, watch ghost buses and bunching appear in real-time, crowd-source passenger intelligence with zero-friction one-tap reporting, and weave multimodal journeys threading bus, Luas, DART, and Dublin Bikes into flowing ribbons with live carbon savings.

**BusIQ is not a dashboard. It's a nervous system for Dublin's transit.**

---

## The Four Pillars

### Pillar 1 — Data & Visualisation: "The Heartbeat"

| What we built | Technical detail |
|---|---|
| Full-bleed dark map with 1,000+ live bus positions updating every 15 seconds | react-map-gl v8 + Mapbox GL JS, WebSocket streaming from NTA GTFS-RT |
| Route arteries: all 116 Dublin Bus routes rendered as GeoJSON polylines | GTFS Static shapes.txt → GeoJSON FeatureCollection |
| 4,331 bus stop heartbeats at high zoom | GTFS Static stops.txt with dot-per-stop rendering |
| Pulse Ring: live bus counter with animated ring proportional to fleet activity | CSS `@keyframes pulse-ring` with dynamic radius |
| Vehicle info cards: tap any bus → speed, delay, route, occupancy | Click-to-select with Zustand state, Mapbox `queryRenderedFeatures` |
| Route hover cards: hover any route line → route name + vehicle count | `onMouseMove` with `interactiveLayerIds` filtering |

**Why it matters**: Dublin Bus knows their routes. They've never *watched them breathe*. Real-time visualisation transforms operational data into institutional insight.

---

### Pillar 2 — Optimisation: "The Oracle"

| What we built | Technical detail |
|---|---|
| ETA prediction engine | Heuristic v1: distance-based with GTFS-RT delay/speed adjustment, confidence scoring |
| Ghost Bus Scanner | Cross-reference GTFS schedule vs live positions. Vehicles >120s stale = ghosts. Routes with zero live buses = dead routes. |
| Bunching Detection | Pairwise haversine distance on same-route vehicles. <400m = bunching. Severity: mild/moderate/severe with scoring. |
| Ghost panel: expandable overlay showing signal-lost vehicles + flagged dead routes | Live-polled from `/api/v1/predictions/ghosts` every 30s |
| Bunching panel: severity-coded bunching events with route context | Live-polled from `/api/v1/predictions/bunching` every 30s |

**Why it matters**: Ghost buses cost Dublin Bus credibility. Bunching wastes capacity. BusIQ makes the invisible visible in real-time — no historical data required, just live GTFS-RT.

---

### Pillar 3 — Collaboration: "The Human Layer"

| What we built | Technical detail |
|---|---|
| One-Tap Crowd Report | Tap bus → 4-button card (🟢Empty, 🟡Seats, 🟠Standing, 🔴Full). One tap, done. No login. | 
| Redis-backed report storage | Per-vehicle, per-route aggregation. 1hr TTL. Pub/sub for real-time push. |
| Community Pulse feed | Scrolling anonymised feed: "🟠 Standing — Route 39A, 2 min ago." Auto-refreshing every 15s. |
| Impact Counter | Persistent total: "Dublin passengers have submitted X reports." Gamification without accounts. |
| Sentiment Aurora | Gradient wash across screen — green when network calm, amber when stressed, red in crisis. Mood ring for the city. |

**Why it matters**: 165 million annual Dublin Bus passengers aren't just riders — they're sensors. BusIQ turns every phone into a real-time data source, zero barrier to entry.

---

### Pillar 4 — Smart Cities: "The Journey Weaver"

| What we built | Technical detail |
|---|---|
| Dublin Bikes integration | CityBik.es API — 115 stations, real-time bike + dock availability |
| Luas integration | luasforecasting.gov.ie XML parser — 63 stops across Red + Green lines |
| DART integration | api.irishrail.ie XML parser — 25 stations with real-time arrivals |
| Multimodal Journey Planner | Heuristic engine: bus + Luas + DART + bike + walk. Returns top 3 door-to-door options. |
| Journey Ribbons | Animated bezier curves on map, colour-coded per mode (bus=teal, Luas=purple, DART=blue, bike=green, walk=grey). Parallel ribbons for alternatives. |
| Transfer Nodes | Glowing interchange diamonds at mode-switch points with wait time. Pulse urgently when <2 min. |
| Carbon Calculator | CO₂ per mode vs car (car=170g/km, bus=89, Luas=25, DART=30, bike/walk=0). Persistent floating badge. |
| 203 Multimodal Stops | Luas (purple), DART (blue), Dublin Bikes (green) rendered on map at zoom ≥12. |

**Why it matters**: Buses don't exist in isolation. Dublin's Smart City vision requires a unified view of *all* public transport. BusIQ is the first platform to visualise bus, tram, rail, and bike-share in one live canvas with real-time journey planning.

---

## Technical Architecture

```
    Next.js 16 (App Router)           FastAPI (Python 3.11+)
    ┌─────────────────────┐            ┌──────────────────────┐
    │  Nerve Centre UI    │◄──WS──────►│  23 API endpoints    │
    │  react-map-gl v8    │◄──REST────►│  GTFS-RT ingestion   │
    │  Zustand store      │            │  5 data services     │
    │  Framer Motion      │            │  Redis (fakeredis)   │
    │  Glass Rail design  │            │  PostgreSQL+PostGIS  │
    └─────────────────────┘            └──────────────────────┘
                                              │
                                       ┌──────┴──────────┐
                                       │ NTA GTFS/GTFS-RT│
                                       │ CityBik.es      │
                                       │ Luas Forecast   │
                                       │ Irish Rail API   │
                                       └─────────────────┘
```

| Layer | Stack | Why |
|---|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind | SSR, React ecosystem, rapid iteration |
| Maps | Mapbox GL JS via react-map-gl v8 | Best-in-class for large-scale real-time geo viz |
| Backend | FastAPI (Python, async) | Auto OpenAPI docs, sub-30ms response times, ML-native |
| Cache | Redis 7 (fakeredis fallback) | Sub-ms reads for live bus state, pub/sub for WebSocket |
| Database | PostgreSQL 16 + PostGIS | Spatial queries for nearest-stop lookups |
| Data | NTA GTFS-RT + 3 multimodal APIs | Real-time, open, production-grade |

---

## Key Numbers

| Metric | Value |
|---|---|
| Live API endpoints | 23 |
| Live data sources | 4 (NTA, CityBik.es, Luas, Irish Rail) |
| Bus routes mapped | 116 |
| Bus stops rendered | 4,331 |
| Multimodal stops | 203 (63 Luas + 25 DART + 115 Dublin Bikes) |
| Live buses tracked | 300-1,100+ depending on time of day |
| Journey options | Top 3 multimodal per request |
| CO₂ savings per journey | Calculated in real-time vs private car |
| Frontend components | 17 (7 map layers + 10 glass overlays) |
| Backend services | 7 core services |
| Code written | 15,000+ lines across 80+ files |

---

## Open Data API

BusIQ provides a complete REST API that other Smart Dublin services can build on:

```
GET  /api/v1/buses                  → Live fleet positions (GeoJSON)
GET  /api/v1/routes                 → All route metadata
GET  /api/v1/routes/shapes          → Route geometry (GeoJSON)
GET  /api/v1/predictions/eta/{stop} → Predicted arrivals
GET  /api/v1/predictions/ghosts     → Ghost buses right now
GET  /api/v1/predictions/bunching   → Bunching events right now
POST /api/v1/crowding/report        → Submit crowd report
GET  /api/v1/crowding/snapshot      → Aggregate crowding state
GET  /api/v1/journey/plan           → Multimodal journey planner
GET  /api/v1/journey/bikes          → Dublin Bikes live
GET  /api/v1/journey/stops          → All multimodal stops (GeoJSON)
```

Full interactive API documentation at `/docs` (Swagger UI) and `/redoc`.

---

## PWA & Deployment

- **Progressive Web App**: manifest.json + service worker for offline static caching
- **Mobile responsive**: Glass panels collapse to bottom sheet on <768px
- **Dark mode only**: Transit visualisation demands dark backgrounds — contrast, drama, professionalism
- **Deployment target**: Single VPS (Hetzner €10/mo). Zero vendor lock-in.

---

## Demo Mode

BusIQ includes a built-in **3-minute auto-pilot demo** that walks through all four pillars with scripted camera movements and teleprompter narration. Press the ▶ DEMO button in the top-right corner.

The demo choreography:
1. **0:00** — Zoom in. Buses materialize. "This is Dublin, alive."
2. **0:15** — Data & Viz. Route arteries. Stop heartbeats. Fleet counter.
3. **0:45** — Optimisation. Ghost buses appear. Bunching detected.
4. **1:30** — Collaboration. Crowd reports. Community pulse. Sentiment aurora.
5. **2:00** — Smart Cities. Multimodal ribbons. Carbon savings. "Leave Now."
6. **2:45** — Zoom out. All buses visible. "One platform. Four pillars. Ready to deploy."

---

## What's Next

| Phase | Description | Timeline |
|---|---|---|
| ML Predictions | LightGBM model trained on accumulated GTFS-RT history → 15%+ more accurate ETAs | 4-6 weeks of data collection |
| Demand Heatmap | Thermal visualisation of passenger demand patterns through the day | Requires historical data |
| Accessibility Reporter | Long-press stop → report broken ramp, no audio, display broken | Requires moderation queue |
| Mobile App | React Native wrapper with push notifications for journey alerts | Post-challenge |
| Smart Dublin Integration | Open API endpoints for City Council dashboards and decision-making | Ongoing |

---

## Team

**Built by passionate transit data engineers who believe Dublin deserves world-class public transport intelligence.**

---

## Contact

- **Project**: BusIQ
- **Repository**: github.com/[your-repo]/dublin-bus-intelligence
- **Challenge**: Dublin Bus Innovation Challenge
- **Pillar**: Smart Cities (primary), spanning all four pillars

---

*BusIQ — making Dublin's transit heartbeat visible.*
