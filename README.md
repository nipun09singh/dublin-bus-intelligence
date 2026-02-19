# BusIQ — Dublin Bus Intelligence Platform

<p align="center">
  <strong>A real-time predictive intelligence layer for Dublin's bus network</strong><br>
  <em>One platform. Four pillars. Built on data Dublin Bus already has.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Dublin_Bus_Innovation-€60K_Challenge-00808B?style=for-the-badge" alt="DBI Challenge" />
  <img src="https://img.shields.io/badge/APIs-23_endpoints-2ecc71?style=for-the-badge" alt="API Endpoints" />
  <img src="https://img.shields.io/badge/Data_Sources-4_live-f39c12?style=for-the-badge" alt="Data Sources" />
  <img src="https://img.shields.io/badge/PWA-Ready-0072CE?style=for-the-badge" alt="PWA Ready" />
</p>

---

## What is BusIQ?

BusIQ transforms Dublin Bus's existing GTFS/GTFS-RT data into a **living nervous system** that spans all four Dublin Bus Innovation Challenge pillars:

| Pillar | Feature | Status |
|---|---|---|
| **Data & Visualisation** | Live 1,000+ bus map, route arteries, stop heartbeats, fleet counter | ✅ Live |
| **Optimisation** | ETA predictions, ghost bus scanner, bunching detection | ✅ Live |
| **Collaboration** | One-tap crowd reports, community pulse feed, sentiment aurora | ✅ Live |
| **Smart Cities** | Multimodal journey planner (Bus+Luas+DART+Bikes), carbon tracker | ✅ Live |

---

## Quick Start

### Without Docker (local dev)

```bash
# Backend (Python 3.10+)
pip install -r requirements.txt
cp .env.example .env          # Add your NTA_API_KEY and NEXT_PUBLIC_MAPBOX_TOKEN
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Frontend (Node 18+)
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

### With Docker

```bash
cp .env.example .env          # Configure API keys
docker compose up -d
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000/docs
```

---

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Next.js 16 Frontend    │◄───►│  FastAPI Backend          │
│  react-map-gl v8        │ WS  │  23 API endpoints         │
│  Zustand + Framer Motion│ REST│  GTFS-RT ingestion (15s)  │
│  Glass Rail design      │     │  Redis + PostgreSQL       │
└─────────────────────────┘     └────────────┬─────────────┘
                                             │
                                   ┌─────────┴──────────┐
                                   │ NTA GTFS-RT         │
                                   │ CityBik.es (Bikes)  │
                                   │ Luas Forecasting    │
                                   │ Irish Rail API      │
                                   └────────────────────┘
```

```
frontend/        → Next.js Nerve Centre (dark-canvas map UI)
backend/         → FastAPI REST + WebSocket APIs
  api/v1/        → Route handlers (buses, routes, predictions, crowding, journey)
  services/      → Business logic (ingestion, predictions, ghost/bunching detection,
                   crowd reports, journey planner, bikes, luas, dart, carbon)
  core/          → Redis, database, config
docs/            → DESIGN.md (living design doc) + PITCH.md (submission)
tests/           → Performance benchmarks
ml/              → Model training pipeline (future)
```

---

## API Endpoints (23 total)

| Group | Endpoints | Description |
|---|---|---|
| **Fleet** | `GET /buses` | Live vehicle positions (300-1,100+) |
| **Routes** | `GET /routes`, `/routes/shapes`, `/routes/search`, `/routes/{id}` | 116 routes + GeoJSON shapes |
| **Predictions** | `GET /predictions/eta/{stop}`, `/ghosts`, `/bunching`, `/bunching/routes/{id}` | ETA, ghost buses, bunching |
| **Crowding** | `POST /crowding/report`, `GET /snapshot`, `/recent`, `/vehicle/{id}` | Crowd-sourced intelligence |
| **Journey** | `POST /journey/plan`, `GET /bikes`, `/luas/{code}`, `/dart/{code}`, `/stops` | Multimodal planner |
| **System** | `GET /healthz`, `WS /ws/live` | Health check, live WebSocket |

Full Swagger UI at `http://localhost:8000/docs`.

---

## Key Numbers

| Metric | Value |
|---|---|
| Live buses tracked | 300 – 1,100+ (time-dependent) |
| Bus routes | 116 |
| Bus stops | 4,331 |
| Multimodal stops | 203 (Luas 63 + DART 25 + Bikes 115) |
| Frontend components | 17 (7 map layers + 10 glass overlays) |
| Backend services | 7 core |
| External APIs | 4 live data sources |
| Update frequency | 15 seconds |

---

## Demo Mode

Press **▶ DEMO** in the top-right corner for a scripted 3-minute walkthrough of all four pillars with automatic camera movements and teleprompter narration.

---

## Performance Benchmark

```bash
python -m tests.benchmark --rounds 50
# Target: p95 < 200ms for all endpoints
```

---

## Design System — Glass Rail

- **Dark mode only** — transit viz demands dark backgrounds
- **Glass panels** — `rgba(0,0,0,0.6)` + `blur(20px)`, never opaque
- **Inter typeface** — tabular numerals for counters
- **Spring physics** — Framer Motion for all transitions
- **60fps target** — GPU-only animations (transform, opacity)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, react-map-gl v8, Zustand, Framer Motion |
| Backend | FastAPI, Python 3.10+, Pydantic v2, structlog |
| Database | PostgreSQL 16 + PostGIS |
| Cache | Redis 7 (fakeredis fallback) |
| Maps | Mapbox GL JS (dark-v11 style) |
| Data | NTA GTFS/GTFS-RT, CityBik.es, Luas Forecasting, Irish Rail |
| PWA | Service worker with cache-first static + network-first API |

---

## Docs

- [Design Document](docs/DESIGN.md) — full technical specification (~600 lines)
- [Pitch / Submission](docs/PITCH.md) — competition submission document

---

## License

MIT
