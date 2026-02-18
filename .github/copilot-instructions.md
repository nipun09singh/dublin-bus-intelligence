# Copilot Instructions — BusIQ (Dublin Bus Intelligence Platform)

## Project Identity

- **Name**: BusIQ
- **One-liner**: A real-time intelligence layer for Dublin's bus network that predicts, visualises, and optimises the passenger experience.
- **Purpose**: Win the Dublin Bus Innovation (DBI) €60,000 challenge under the Smart Cities pillar, then use the win as YC traction proof.
- **Design Doc**: Always read `docs/DESIGN.md` for full context before making architectural decisions. Update it when decisions change.

---

## Repository Structure

```
dublin-bus-intelligence/          ← monorepo root
├── .github/
│   └── copilot-instructions.md   ← YOU ARE HERE
├── docs/
│   └── DESIGN.md                 ← living design doc (single source of truth)
├── ingestion/                    ← Python: GTFS, GTFS-RT, weather, events pollers
│   ├── gtfs_static/
│   ├── gtfs_realtime/
│   ├── weather/
│   └── events/
├── backend/                      ← FastAPI application
│   ├── api/                      ← route handlers
│   │   └── v1/
│   ├── core/                     ← config, security, dependencies
│   ├── models/                   ← SQLAlchemy / Pydantic models
│   ├── services/                 ← business logic
│   ├── ml/                       ← model loading, inference
│   └── main.py
├── frontend/                     ← Next.js 14 App Router
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── public/
├── ml/                           ← model training, evaluation, export
│   ├── notebooks/
│   ├── training/
│   ├── evaluation/
│   └── models/                   ← exported ONNX models
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── Dockerfile.ingestion
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Coding Standards

### Python (Backend + Ingestion + ML)

- **Version**: Python 3.11+
- **Style**: Follow PEP 8. Use `ruff` for linting and formatting.
- **Type hints**: Required on all function signatures. Use `from __future__ import annotations`.
- **Async**: Default to `async def` for all I/O-bound functions. Use `asyncio` and `httpx` (not `requests`).
- **Models**: Use Pydantic v2 `BaseModel` for all API schemas. Use SQLAlchemy 2.0 style (mapped_column).
- **Imports**: Group as stdlib → third-party → local. Absolute imports only.
- **Naming**: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE` for constants.
- **Error handling**: Never bare `except`. Always specify exception types. Use custom exception classes in `backend/core/exceptions.py`.
- **Logging**: Use `structlog` for structured JSON logging. Never `print()` in production code.
- **Testing**: `pytest` + `pytest-asyncio`. Test files mirror source structure in a `tests/` folder.
- **Dependencies**: Managed via `pyproject.toml` with dependency groups (dev, test, ml).

### TypeScript (Frontend)

- **Version**: TypeScript 5.x strict mode.
- **Style**: Follow Next.js App Router conventions. Server Components by default; add `'use client'` only when needed.
- **Naming**: `camelCase` for functions/variables, `PascalCase` for components/types/interfaces, `UPPER_SNAKE` for constants.
- **State**: Use React Server Components where possible. Client state via `zustand` (not Redux).
- **Data fetching**: Server Components use `fetch` with Next.js caching. Client Components use `swr` or `react-query`.
- **Styling**: Tailwind CSS. No CSS modules, no styled-components.
- **Maps**: Mapbox GL JS via `react-map-gl`. All map layers as separate components.
- **Testing**: Vitest + React Testing Library.

### SQL

- **Dialect**: PostgreSQL 16 with PostGIS.
- **Migrations**: Alembic (auto-generate from SQLAlchemy models).
- **Naming**: `snake_case` for tables/columns. Plural table names (`vehicle_positions`, not `vehicle_position`).
- **Indexes**: Always create indexes on columns used in WHERE/JOIN. Spatial indexes via GIST.

---

## Visual Design System — "Glass Rail"

> The UX architecture is fully documented in `docs/DESIGN.md` Section 5. These are the rules for implementation.

### Paradigm

- **The map IS the app.** No sidebar-with-map layout. Full-bleed Mapbox canvas. UI floats over it.
- **Dark mode only.** No light mode. No toggle. Dark backgrounds = better geo-viz contrast, drama, and control-room feel.
- **Four Pillar Modes.** Bottom glass rail switches between Data & Viz / Optimise / Collab / Smart Cities. Each mode transforms map layers — never navigates away.

### Glass Panel Tokens

```css
/* Every floating panel uses these exact values */
--glass-bg: rgba(0, 0, 0, 0.6);
--glass-bg-hover: rgba(0, 0, 0, 0.7);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-border-active: rgba(255, 255, 255, 0.15);
--glass-blur: 20px;
--glass-radius: 16px;
--glass-radius-nested: 12px;
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
```

### Colour Palette

```css
/* Brand */
--busiq-teal: #00808B;         /* Dublin Bus teal — primary actions */
--busiq-teal-glow: #00A8B5;    /* teal at 100% brightness — glows, highlights */

/* Transport Modes */
--mode-bus: #00808B;            /* Dublin Bus */
--mode-luas: #6B2D8B;           /* Luas purple */
--mode-dart: #0072CE;           /* Irish Rail blue */
--mode-bike: #76B82A;           /* Dublin Bikes green */
--mode-walk: #8C8C8C;           /* Walking grey */

/* Semantic Data */
--data-cold: #1B3A5C;           /* Low demand — deep navy */
--data-warm: #D4A843;           /* Medium demand — amber */
--data-hot: #C93545;            /* High demand — crimson */
--data-success: #2ECC71;        /* Good (on-time, accurate) */
--data-warning: #F39C12;        /* Warning (delay, bunching) */
--data-error: #E74C3C;          /* Error (ghost bus, >10 min delay) */

/* Crowd Reports */
--report-crowding: #3498DB;     /* Blue ripple */
--report-accessibility: #E67E22; /* Orange ripple */
--report-positive: #2ECC71;     /* Green ripple */
```

### Typography

- **Font**: `Inter` (variable, loaded via `next/font/google`)
- **Numbers**: Always `font-variant-numeric: tabular-nums` on any counter, stat, or timer.
- **Scale**: 12px (caption) / 14px (body) / 16px (subtitle) / 20px (title) / 28px (hero stat).
- **Weight**: 400 (body) / 500 (labels) / 600 (emphasis) / 700 (hero numbers).
- **Colour**: `rgba(255,255,255,0.9)` primary, `rgba(255,255,255,0.6)` secondary, `rgba(255,255,255,0.35)` tertiary.

### Animation Rules

1. **All transitions**: `200ms ease-out`. Never instant. Never over 300ms.
2. **Spring physics**: Bus markers use spring interpolation (damping: 0.8, stiffness: 120) when moving to new GPS positions.
3. **Stagger**: Multiple elements appearing = 30ms stagger, left-to-right or centre-outward.
4. **Data aging**: `opacity: max(0.5, 1 - (ageSeconds / 60))` on vehicle markers. Old data fades.
5. **GPU only**: Animate only `transform` and `opacity`. Never animate `width`, `height`, `top`, `left`.
6. **Map camera**: Use Mapbox `easeTo` (not `flyTo`) for in-page transitions. `flyTo` only for cross-city jumps.

### Map Layer Z-Order (bottom to top)

1. Mapbox dark basemap
2. Demand thermal heatmap (WebGL)
3. Route arteries (line layer with flow particles)
4. Stop heartbeat circles
5. Vehicle markers with trails
6. Ghost bus outlines (Optimisation mode)
7. Bunching arcs (Optimisation mode)
8. Crowd report ripples (Collaboration mode)
9. Journey ribbons (Smart Cities mode)
10. Glass UI panels (HTML overlay)

### Component Naming

All map-related components follow this pattern:
- `layers/` — Mapbox source+layer definitions (e.g., `RouteArteryLayer.tsx`, `VehicleMarkerLayer.tsx`)
- `overlays/` — Glass panels positioned over the map (e.g., `PulseRingOverlay.tsx`, `PillarRailOverlay.tsx`)
- `modes/` — Pillar mode containers (e.g., `DataVizMode.tsx`, `OptimiseMode.tsx`)
- `controls/` — Interactive controls (e.g., `TimeScrubber.tsx`, `ModeSwitcher.tsx`)

---

## Key Technical Rules

1. **Real-time first**: Every feature should work with live data. Mock data is only for when APIs are unavailable.
2. **Latency budget**: API responses must be <200ms p95. Map renders must achieve 60fps with 1,100 bus markers.
3. **Data pipeline reliability**: Ingestion workers must handle API failures gracefully — exponential backoff, dead letter logging, never crash.
4. **ML model versioning**: Every model artifact is versioned (`lgbm-v1.0.onnx`). Never overwrite a model in place.
5. **Geo-coordinates**: Always WGS 84 (EPSG:4326). All coordinates are [longitude, latitude] in GeoJSON (Mapbox convention).
6. **Timestamps**: Always UTC internally. Convert to Europe/Dublin only at the presentation layer.
7. **Environment variables**: All secrets and config via `.env`. Never hardcode API keys. Use `pydantic-settings` for validation.
8. **Docker-first local dev**: `docker-compose up` must bring up the entire stack (Postgres, Redis, backend, ingestion, frontend).

---

## API Design Rules

- All endpoints versioned under `/api/v1/`.
- RESTful resource naming: `/buses`, `/routes/{route_id}/stops`, `/predictions`.
- WebSocket at `/ws/live` for real-time bus position streaming.
- Standard response envelope:
  ```json
  {
    "data": { ... },
    "meta": { "timestamp": "...", "version": "1.0" }
  }
  ```
- Errors follow RFC 7807 Problem Details format.
- Pagination via cursor-based pagination (not offset).
- Rate limiting: 100 req/min for public API, no limit for internal.

---

## Git Conventions

- **Branch naming**: `feat/`, `fix/`, `data/`, `ml/`, `docs/` prefixes.
- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `data:`, `ml:`).
- **PR rule**: Every PR must reference a phase from the design doc (e.g., "Phase 2: Live bus map").

---

## Design Doc Update Protocol

When making significant decisions or completing features, update `docs/DESIGN.md`:
1. Mark completed items with `[x]` in the Build Phases section.
2. Add new decisions to the Decision Log with date and rationale.
3. If architecture changes, update Section 5.
4. If new data sources are added, update Section 5.3 and Appendix B.

---

## Performance Targets

| Metric | Target |
|---|---|
| API p95 latency | <200ms |
| Map FCP | <1.5s |
| Bus position freshness | <3s from NTA source |
| ML prediction MAE improvement | ≥15% vs GTFS-RT |
| Docker compose startup | <30s |
| Frontend bundle size (gzipped) | <150KB initial load |

---

## Priority Order (What Wins the Challenge)

1. **The 3-second first impression** — Full-bleed dark map, 1,100 buses materialising, route arteries flowing. The judge must say "whoa" before they touch anything.
2. **The pillar mode transitions** — Seamless layer transformations. One canvas, four lenses. This IS the architectural thesis.
3. **The Time Machine** (Optimisation) — Split-screen predicted vs. actual. Concrete, measurable, undeniable. "BusIQ was 23% more accurate."
4. **The Journey Weaver** (Smart Cities) — Multimodal ribbons. This is The Future and it looks like it.
5. **Predictive accuracy** — Show the concrete numbers. But the visual proof (item 3) matters more than a table of metrics.
6. **Collaboration ripples** — Turns passengers into sensors. Simple, human, powerful.
7. **Narrative** — The submission story matters as much as the tech. Write for non-technical judges (CEO, Minister, Technology Manager).
8. **Open API** — Signals platform thinking, not just an app.

---

## External API Keys Needed

| Service | Status | Notes |
|---|---|---|
| NTA GTFS-RT | ⬜ Not applied | Apply at developer.nationaltransport.ie |
| Mapbox | ⬜ Not created | Free tier: 50k map loads/mo |
| Met Éireann | ✅ Open | No key needed |
| JCDecaux (Dublin Bikes) | ⬜ Not applied | developer.jcdecaux.com |
| Luas Forecasting | ✅ Open | No key needed |
| Irish Rail | ✅ Open | No key needed |
