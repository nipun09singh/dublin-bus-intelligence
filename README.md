# BusIQ — Dublin Bus Intelligence Platform

> A real-time intelligence layer for Dublin's bus network that predicts, visualises, and optimises the passenger experience.

Built for the [Dublin Bus Innovation Challenge](https://www.dublinbus.ie) (€60,000 seed fund).

---

## Quick Start

```bash
# 1. Clone & configure
cp .env.example .env
# Edit .env with your API keys (NTA, Mapbox, JCDecaux)

# 2. Start everything
docker compose up -d

# 3. Open
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000/docs
# Postgres:  localhost:5432
# Redis:     localhost:6379
```

## Architecture

```
ingestion/   → Python asyncio workers pulling GTFS-RT, weather, events
backend/     → FastAPI serving REST + WebSocket APIs
frontend/    → Next.js 14 Nerve Centre with Mapbox GL
ml/          → Model training, evaluation, ONNX export
```

See [docs/DESIGN.md](docs/DESIGN.md) for the full design document.

## The Four Pillars

| Pillar | Feature | Status |
|---|---|---|
| Data & Visualisation | Live fleet map, demand heatmap, time scrubber | 🔲 |
| Optimisation | Predictive ETAs, ghost bus detection, bunching alerts | 🔲 |
| Collaboration | Crowdsourced crowding, accessibility reporting | 🔲 |
| Smart Cities | Multimodal journey planner, carbon tracker, Open API | 🔲 |

## License

MIT
