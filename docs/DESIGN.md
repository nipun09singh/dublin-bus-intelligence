# Dublin Bus Intelligence Platform — Design Document

> **Living document.** Updated at every build phase. This is the single source of truth for what we're building, why, and how.

---

## 1. Mission

Win the Dublin Bus Innovation (DBI) €60,000 seed funding challenge by building a **real-time predictive bus intelligence platform** that is technically impressive, visually stunning, and immediately useful to 165M annual passengers — then leverage the win as traction proof for a Y Combinator application.

---

## 2. Strategic Context

### 2.1 The Challenge

| Detail | Info |
|---|---|
| **Organiser** | Dublin Bus (Ireland's largest public transport provider) |
| **Total Fund** | €60,000 across four pillars (€15,000 each) |
| **Pillars** | Data & Visualisation · Optimisation · Collaboration · Smart Cities |
| **Partners** | Smart Dublin (Smart Cities pillar) |
| **Submission** | Via Dublin Bus Innovation portal at www.dublinbus.ie |
| **Key Stats** | 165M passengers/year · 1,100 buses · 9 depots |

### 2.2 Our Angle

Submit under **Smart Cities** (highest visibility, Smart Dublin backing) but design the platform to span all four pillars. Frame it as:

> "A single intelligence layer that turns Dublin Bus's existing data into predictive, passenger-facing tools — starting with one prototype, designed to scale across all four innovation areas."

### 2.3 YC Narrative

- "We won a national innovation challenge, got seed funding, and deployed to a system serving 165M passengers/year."
- Demonstrates: ability to ship, technical depth, real traction, civic impact.

---

## 3. Product Vision

### 3.1 One-Line

**BusIQ** — a real-time intelligence layer for Dublin's bus network that predicts, visualises, and optimises the passenger experience.

### 3.2 Core Value Propositions

| For Whom | Value |
|---|---|
| **Passengers** | Know exactly when your bus arrives, how crowded it'll be, and the fastest multimodal route — before you leave home. |
| **Dublin Bus Ops** | See live demand vs. supply heatmaps, detect ghost buses, forecast depot-level demand. |
| **The City (Smart Dublin)** | A reusable intelligence layer that any transit operator or city planner can plug into. |

---

## 4. Features — Mapped to DBI Pillars

### 4.1 Data & Visualisation (Pillar 1)

| Feature | Description | Complexity |
|---|---|---|
| **Live Fleet Map** | Real-time Mapbox GL map showing all ~1,100 buses with route colouring, direction arrows, and speed indicators. | Medium |
| **Demand Heatmap** | 30-min rolling forecast of passenger demand per stop/corridor overlaid on the city map. Trained on historical boarding data + time/day/weather/events. | High |
| **Route Health Dashboard** | Per-route scorecards: on-time %, crowding index, service gaps, trend sparklines. | Medium |

### 4.2 Optimisation (Pillar 2)

| Feature | Description | Complexity |
|---|---|---|
| **Predictive ETA Engine** | ML model (LightGBM → Transformer) trained on historical GPS traces + weather + calendar + event data. Target: beat official GTFS-RT ETAs by ≥15%. | High |
| **Ghost Bus Detector** | Flag buses that appear in schedule but not in real-time feed (phantom services). Surface to ops dashboard. | Medium |
| **Bunching Detector** | Real-time detection of bus bunching on a route; trigger alert + suggest hold/express strategy. | Medium |

### 4.3 Collaboration (Pillar 3)

| Feature | Description | Complexity |
|---|---|---|
| **Crowd-Sourced Crowding** | Passengers report crowding level (empty / seats / standing / full) via a single tap. Aggregate + display on map. | Medium |
| **Accessibility Reporter** | Report broken ramps, non-functional displays, audio issues. Geo-tagged, time-stamped, anonymised. | Low |
| **Community Pulse Feed** | Live feed of anonymised passenger sentiment — "What Dublin is saying about the bus today." | Low |

### 4.4 Smart Cities (Pillar 4) — Primary Submission

| Feature | Description | Complexity |
|---|---|---|
| **Multimodal "Leave Now" Router** | Integrate Dublin Bus, Luas, DART, Dublin Bikes, and walking into a single door-to-door journey planner with real-time data. | High |
| **Carbon Savings Tracker** | Estimate CO₂ saved per journey vs. private car. Gamify with daily/weekly leaderboards. | Low |
| **Open Data API** | RESTful + WebSocket API exposing our predictions and aggregations so other city services can build on top. | Medium |

---

## 5. UX Architecture — The "Holy Moly" Blueprint

> **Design philosophy**: BusIQ is not a dashboard with maps. It's a **living nervous system** that makes Dublin's transit heartbeat visible. Every pixel must earn its place. Every animation must carry meaning. Every interaction must reveal insight that was previously invisible.

### 5.0 The Interface Paradigm: "The Nerve Centre"

The entire app is **one continuous canvas** — a full-bleed Mapbox map that IS the interface. There is no sidebar-with-a-map layout. The map is the app. UI elements float over it as translucent glass panels that breathe with the data underneath.

**The judge sees this on first load (in under 1.5 seconds):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌─BusIQ──────────────────────────────────────────────────────────┐  │
│ │                                                                │  │
│ │  ┌─────────────┐                                               │  │
│ │  │ PULSE RING  │  ← top-left: animated city pulse counter      │  │
│ │  │ 1,087 buses │     glows brighter as network gets busier     │  │
│ │  │   active    │                                               │  │
│ │  └─────────────┘                                               │  │
│ │                                                                │  │
│ │         🚌→        🚌→                                         │  │
│ │              🚌→          🚌→        ← buses as living          │  │
│ │     🚌→                       🚌→      directional particles   │  │
│ │          🚌→    🚌→                    on route arteries        │  │
│ │                        🚌→                                     │  │
│ │     ░░░▓▓▓████▓▓░░░                ← demand heatmap pulses    │  │
│ │                                       beneath, like body heat  │  │
│ │                                                                │  │
│ │  ┌──────────────────────────────────────────────────────────┐  │  │
│ │  │ ═══════○════════════○═══════●═══════○═══════            │  │  │
│ │  │  DATA & VIZ    OPTIMISE    COLLAB     SMART CITIES      │  │  │
│ │  │                                                         │  │  │
│ │  │  ← bottom glass rail: the four pillars as a mode        │  │  │
│ │  │    switcher. Active pillar transforms the map layers.    │  │  │
│ │  └──────────────────────────────────────────────────────────┘  │  │
│ └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this wins**: The judge doesn't learn a new UI. They see Dublin. Alive. Breathing. They immediately understand it.

---

### 5.1 The Four Pillar Modes — Each a "Signature Moment"

When the user selects a pillar from the bottom glass rail, the map doesn't navigate away — it **transforms**. Layers fade in/out, the colour palette shifts, and the data story changes. Same canvas, different lens. This is the architectural key — one platform, four perspectives.

#### 5.1.1 Data & Visualisation Mode — "The Heartbeat"

**Signature moment**: The judge slides a time scrubber and watches Dublin's transit demand **pulse forward through the day** — 6am quiet blue → 8am erupting red → 10am cooling → 5pm exploding again. They've never seen their own city breathe like this.

**Visual Language**:
- **Colour**: Deep navy background → warm amber/crimson for high demand
- **Route arteries**: Bus routes rendered as translucent flowing lines. Width = frequency. Brightness = current load.
- **Stop heartbeats**: Each bus stop is a small circle that pulses outward every time a bus arrives. High-frequency stops pulse fast. Dead stops go dark.
- **Demand thermal layer**: A WebGL heatmap underneath everything — not the standard red blob, but a custom shader that looks like infrared thermal imaging of the city's movement.

**Key Interactions**:

| Interaction | What Happens | Technical Detail |
|---|---|---|
| **Time Scrubber** | Drag through 24 hours. The heatmap, stop pulses, and route brightness animate in real-time showing how demand flows through the city. | Pre-computed 15-min interval snapshots. WebGL interpolation between frames. Canvas-based scrubber with momentum. |
| **Route Hover** | Route line thickens + glows. A floating glass card shows: route name, on-time %, avg wait, crowding trend sparkline. | Mapbox `feature-state` for hover. Card positioned via Mapbox popup but custom-rendered React portal. |
| **Stop Click** | Zooms smoothly to stop. Radial timeline appears around the stop showing next 6 arrivals as dots on a clock face. Each dot = a bus, sized by predicted crowding. | Framer Motion for the radial animation. Data from prediction engine. |
| **"Network Pulse" Toggle** | Switches from geographic view to a **stylised metro-map schematic** where routes become clean straight lines. Shows the same live data but in a diagrammatic view. Beautiful for presentations. | Pre-computed schematic coordinates. Mapbox custom layer with d3-force layout for node positions. |

**The Micro-Details That Create "Insane"**:
- Buses don't just move on the map. They leave a **fading trail** (last 30 seconds of GPS) so you can see direction and speed at a glance — like long-exposure photography of traffic.
- When a bus is delayed >5 minutes, its marker subtly shifts from Dublin Bus teal to a warm amber, then to red. No legend needed — the meaning is intuitive.
- Route lines have a subtle **flow animation** (tiny particles moving along the line in the direction of travel) — like blood flowing through veins. This is what makes the map feel alive.

---

#### 5.1.2 Optimisation Mode — "The Time Machine"

**Signature moment**: A split-screen comparison. Left side: "What Dublin Bus told you." Right side: "What BusIQ would have told you." The judge watches actual trips from yesterday and sees, in real-time, how our predictions beat the official system. Concrete. Undeniable. Measurable.

**Visual Language**:
- **Colour**: Cool steel blues + electric green (accuracy) vs. warm red (error)
- **Split pane**: The map literally splits with a draggable divider — left = official GTFS-RT, right = BusIQ prediction. Same moment, same buses, different accuracy.
- **Ghost buses**: Scheduled buses with no real-time signal appear as **translucent phantom outlines** drifting along their route — haunting and immediately obvious. They look like ghosts.
- **Bunching**: When two buses on the same route get within 200m, a red **magnetic field arc** appears between them, visually screaming "these are too close."

**Key Interactions**:

| Interaction | What Happens | Technical Detail |
|---|---|---|
| **Time Machine Replay** | Pick any route + date from the past 30 days. Watch the trip replay at 10x speed with our prediction overlaid against the official ETA and actual arrival. Three timelines stacked. | Historical data from PostgreSQL. D3.js for the triple-timeline. Mapbox camera follows the bus. |
| **Accuracy Scoreboard** | Live-updating leaderboard: "BusIQ was more accurate on X% of predictions today. Average improvement: Y seconds." | Computed from real-time comparison pipeline. Animated counter (like a stock ticker). |
| **Ghost Bus Scanner** | Toggle to highlight all current ghost buses. Each ghost has a tooltip: "Route 46A, scheduled 08:15, no signal for 12 min." | Cross-reference GTFS schedule vs GTFS-RT vehicle positions. Scheduled-only buses rendered with CSS `opacity: 0.3` + dashed outline. |
| **Bunching Alert Feed** | Right-edge glass panel showing a live feed of bunching events as they happen, sorted by severity. Click to fly to the location. | WebSocket push from backend detector. Each alert auto-expires after resolution. |

**The Micro-Details**:
- The split-screen divider has a subtle **electric current animation** running along it — signals this is a live comparison, not a static image.
- Ghost buses cast a subtle **shadow on the route line** below them — literally ghosts casting shadows.
- When our prediction is proven more accurate, the BusIQ side of the split view gets a brief **green shimmer** pulse. Subliminal positive reinforcement.

---

#### 5.1.3 Collaboration Mode — "The Human Layer"

**Signature moment**: The judge sees crowdsourcing reports appearing on the map in real-time as gentle **ripples** — like raindrops on water. Each report creates a visible impact. The judge realises: 165 million passengers aren't just riders, they're sensors. The city is watching itself.

**Visual Language**:
- **Colour**: Warm teal + Dublin Bus brand green + soft white
- **Ripple effect**: Each new crowd report creates an expanding concentric circle at the geo-location, fading over 60 seconds. Colour = report type (blue = crowding, orange = accessibility, green = positive).
- **Heatmap of reports**: Over time, areas with many reports build up a glow — showing systemic issues vs. one-offs.
- **Sentiment aurora**: A soft gradient across the top of the screen that shifts colour based on aggregate passenger sentiment. Green = happy network. Amber = stressed. Red = crisis. Like a mood ring for the city.

**Key Interactions**:

| Interaction | What Happens | Technical Detail |
|---|---|---|
| **One-Tap Report** | User taps a bus on the map → floating 4-button report card appears: 🟢 Empty, 🟡 Seats, 🟠 Standing, 🔴 Full. One tap, done. | Geolocation-aware. Nearest-bus detection via spatial query. Stores: bus_id, route, timestamp, level. No login required. |
| **Accessibility Alert** | Long-press a stop → report: broken ramp, no audio, display broken. Icon badge appears on the stop. | Moderated queue. Badges clear after Dublin Bus marks resolved. |
| **Community Pulse** | Expandable glass panel with scrolling anonymised feed: "🟠 Standing room only — 39A near Phibsborough, 2 min ago." | WebSocket feed. Rate-limited display (max 1 per 3 seconds to avoid overwhelm). |
| **Impact Counter** | Persistent stat: "Dublin passengers have submitted 12,847 reports, improving 214 routes." | Gamification without accounts. Running total since launch. |

**The Micro-Details**:
- The report buttons use **haptic-style CSS animations** — when you tap "Full," the button depress animation feels heavy; "Empty" feels light. Physicality.
- The ripple effect uses the **exact Dublin Bus teal** from their brand guidelines. This isn't our product — it's *their* evolution.
- Accessibility reports use **high-contrast icons** compliant with WCAG AAA — practising what we preach.

---

#### 5.1.4 Smart Cities Mode — "The Journey Weaver"

**Signature moment**: The judge enters an origin and destination. The map draws a **flowing ribbon** through the city, threading through bus → walk → Luas → bike, with each segment a different colour. Alternatives animate alongside like branching rivers. Real-time. Multimodal. Beautiful. They've never seen journey planning look like this.

**Visual Language**:
- **Colour**: Each transport mode has its own colour from a nature-inspired palette:
  - 🚌 Dublin Bus = Forest teal (#00808B)
  - 🚊 Luas = Sunset purple (#6B2D8B — Luas brand)
  - 🚆 DART = Ocean blue (#0072CE — IR brand)
  - 🚲 Dublin Bikes = Lime green (#76B82A)
  - 🚶 Walking = Warm grey (#8C8C8C)
- **Journey ribbon**: The route isn't a standard polyline — it's a **flowing ribbon** with animated dashes moving in the direction of travel. Width indicates capacity/comfort.
- **Transfer nodes**: Where you switch modes, a **glowing interchange diamond** appears with wait time displayed inside.
- **Carbon savings**: A persistent floating badge shows "This journey saves 2.3kg CO₂ vs. driving" with a tiny leaf animation.

**Key Interactions**:

| Interaction | What Happens | Technical Detail |
|---|---|---|
| **"Leave Now" Planner** | Enter origin + destination. Engine returns top 3 multimodal routes. All three animate on the map simultaneously as parallel ribbons. Tap one to select; others fade gracefully. | A* pathfinding on a merged transit graph (GTFS + Luas + DART + Dublin Bikes availability). Real-time departure data from all four APIs. |
| **Departure Time Scroll** | Scroll a time wheel to see how the optimal route changes throughout the day. Watch the ribbons reshape in real-time. | Pre-computed optimal routes at 5-min intervals. Smooth interpolation during scroll. |
| **Mode Toggle** | Toggle transport modes on/off. "No bikes" → routes recalculate without Dublin Bikes segments. "Bus only" → pure Dublin Bus routing. | Graph edges filtered by mode. Re-pathfind on toggle. Sub-200ms for a good UX. |
| **Carbon Leaderboard** | Weekly leaderboard: "Your neighbourhood saved X tonnes of CO₂ by choosing public transport." Anonymised, area-based. | Estimated from journey plans created. No tracking — pure estimation. |

**The Micro-Details**:
- When a Luas or DART is arriving in <2 minutes and it's part of your recommended route, the transfer diamond **pulses urgently** — "go now."
- The journey ribbon has a subtle **gradient that shifts** from your origin's neighbourhood colour to your destination's — you're literally watching a journey unfold through the city's fabric.
- Dublin Bikes segments show the **real-time bike count** at the start station and dock availability at the end station, right on the ribbon — no app-switching needed.

---

### 5.2 The Glass Design System

Every floating UI element follows the **"Glass Rail"** design language:

```
┌─────────────────────────────────────────┐
│  ╭──────────────────────────────────╮   │
│  │                                  │   │
│  │   backdrop-filter: blur(20px)    │   │
│  │   background: rgba(0,0,0,0.6)   │   │
│  │   border: 1px solid             │   │
│  │     rgba(255,255,255,0.08)      │   │
│  │   border-radius: 16px          │   │
│  │   box-shadow:                   │   │
│  │     0 8px 32px rgba(0,0,0,0.4) │   │
│  │                                  │   │
│  ╰──────────────────────────────────╯   │
│                                         │
│    ← dark glass panel floating over     │
│      the map. Translucent, not opaque.  │
│      The map breathes through it.       │
└─────────────────────────────────────────┘
```

**Rules**:
- **Never opaque.** Every panel lets the map show through. The user always knows where they are in the city.
- **Rounded corners**: 16px radius always. 12px for nested cards.
- **Subtle borders**: 1px `rgba(255,255,255,0.08)` — barely visible, but defines the edge.
- **Typography**: Inter (variable weight) — clean, legible at small sizes, excellent number rendering.
- **Numbers**: Tabular numerals (`font-variant-numeric: tabular-nums`) — counters and stats never jitter.
- **Transitions**: All state changes at `200ms ease-out`. Never instant, never slow.
- **Dark mode only**: The map is dark. The UI is dark. This is a night-ops control room, not a sunny dashboard.

### 5.3 Animation Principles

| Principle | Rule | Example |
|---|---|---|
| **Physics-based** | All movement uses spring physics, not linear easing. | Bus markers don't teleport — they glide to new positions with slight overshoot. |
| **Meaningful motion** | Every animation communicates data, never decoration. | A pulse = an arrival event. A glow = high demand. A fade = data is aging. |
| **60fps or nothing** | All animations on the GPU (transform, opacity only). No layout-triggering animations. | Use Mapbox's built-in `easeTo` for camera moves. CSS `will-change: transform` on moving elements. |
| **Staggered reveals** | When multiple elements appear, they stagger 30ms apart from left-to-right or center-outward. | Route cards in search results cascade in, not slam in simultaneously. |
| **Data aging** | Real-time data fades slightly as it ages. A 30-second-old bus position is slightly dimmer than a 2-second-old one. | `opacity: max(0.5, 1 - (age_seconds / 60))` on vehicle markers. |

### 5.4 Responsive Strategy

| Breakpoint | Behaviour |
|---|---|
| **Desktop (>1280px)** | Full Nerve Centre experience. Glass panels positioned at edges. |
| **Tablet (768-1280px)** | Glass panels collapse to bottom sheet (like Google Maps mobile). Pillar rail moves to top. |
| **Mobile (<768px)** | Map fills screen. Bottom sheet with swipe-up for details. One-tap report is thumb-reachable. The mobile experience IS the passenger product; desktop is the ops/judge product. |

### 5.5 The Demo Sequence (What the Judge Sees)

This is the choreographed 3-minute walkthrough:

1. **0:00 — First Load** (3 seconds). Full-bleed dark map of Dublin zooms in from country level. 1,087 buses materialize as glowing dots along their routes. Route arteries begin to flow. The Pulse Ring counts up in the corner. *The judge is already impressed.*

2. **0:15 — Data & Viz Mode**. Slide the time scrubber. Watch Dublin's morning rush erupt. "This is what 165 million passengers look like." Hover a route. Click a stop — see the radial arrival clock.

3. **0:45 — Optimisation Mode**. Split the screen. "Left: what passengers were told today. Right: what BusIQ would have told them." Play back Route 39A from this morning. Show the accuracy scoreboard: "BusIQ was 23% more accurate." Point out a ghost bus. Show bunching on Route 16.

4. **1:30 — Collaboration Mode**. "Now let's turn passengers into sensors." Tap a bus, report crowding in one tap. Watch the ripple appear. Show the community pulse feed. "12,000 reports from real Dubliners."

5. **2:00 — Smart Cities Mode**. "But buses don't exist in isolation." Enter a journey: Phibsborough to Grand Canal Dock. Watch three multimodal ribbons weave across the city. Select one. "This journey saves 2.1kg of CO₂. And the Luas at Connolly is arriving in 90 seconds."

6. **2:45 — Close**. Zoom out. All 1,087 buses visible again. "This is one platform. Four pillars. Built on data Dublin Bus already has. Ready to deploy."

---

## 6. Technical Architecture

### 6.1 High-Level Overview

```
┌────────────────────────────────────────────────────────────┐
│                       CLIENTS                              │
│  Next.js Web App  ·  Future: Mobile PWA  ·  Open API       │
└────────────────┬───────────────────────────┬───────────────┘
                 │          WebSocket         │  REST
                 ▼                           ▼
┌────────────────────────────────────────────────────────────┐
│                    API GATEWAY (FastAPI)                    │
│  /api/v1/buses  ·  /api/v1/predict  ·  /api/v1/crowding   │
│  /api/v1/routes ·  /api/v1/journey  ·  /ws/live            │
└────────┬──────────────┬──────────────┬────────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼─────┐
    │ Redis   │   │ PostgreSQL│  │ ML Model │
    │ (live   │   │ + PostGIS │  │ Service  │
    │  state) │   │ (history) │  │(predict) │
    └────┬────┘   └─────┬─────┘  └──────────┘
         │              │
    ┌────▼──────────────▼────────────────────┐
    │        DATA INGESTION PIPELINE         │
    │  GTFS-RT poller · Weather API poller   │
    │  Event scraper  · Crowdsource ingester │
    └────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────┐
    │         EXTERNAL DATA SOURCES       │
    │  NTA GTFS/GTFS-RT · Met Éireann    │
    │  Eventbrite/local events · TFI      │
    └─────────────────────────────────────┘
```

### 6.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR for SEO, React ecosystem, fast dev |
| **Maps** | Mapbox GL JS | Best-in-class for large-scale real-time geo viz |
| **Backend API** | FastAPI (Python) | Async, fast, auto-docs, ML-native |
| **Database** | PostgreSQL 16 + PostGIS | Spatial queries, mature, free |
| **Cache / Pub-Sub** | Redis 7 | Sub-ms reads for live bus state, pub/sub for WebSocket fan-out |
| **ML Training** | LightGBM (v1) → Temporal Fusion Transformer (v2) | LightGBM: fast iteration; TFT: SOTA for time-series |
| **ML Serving** | ONNX Runtime via FastAPI | Single-process, low latency, no infra overhead |
| **Data Ingestion** | Python asyncio workers | Match the async FastAPI ecosystem |
| **Infra** | Single VPS (Hetzner €10/mo) → scale later | Keep costs near zero for the challenge |
| **CI/CD** | GitHub Actions | Free for public repos |
| **Containerisation** | Docker + docker-compose | Reproducible local + prod |

### 6.3 Data Sources

| Source | Type | Endpoint / Notes |
|---|---|---|
| **NTA GTFS Static** | Schedule data | https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip |
| **NTA GTFS-RT** | Real-time vehicle positions + trip updates | API key from NTA Developer Portal |
| **Met Éireann** | Weather forecasts | Open Data API (hourly JSON) |
| **Dublin Bikes** | Station availability | JCDecaux Open Data API |
| **Luas** | Real-time arrivals | Luas Forecasting API (XML) |
| **DART / Commuter Rail** | Real-time | Irish Rail Realtime API |
| **Events** | Concerts, matches, festivals | Eventbrite API + scraping |

---

## 7. Data Models (Core)

### 7.1 Vehicle Position (Redis — ephemeral)

```json
{
  "vehicle_id": "33017",
  "route_id": "39A",
  "trip_id": "39A_20260218_0830",
  "latitude": 53.3498,
  "longitude": -6.2603,
  "bearing": 215,
  "speed_kmh": 28.4,
  "timestamp": "2026-02-18T08:32:14Z",
  "occupancy_status": "MANY_SEATS_AVAILABLE",
  "delay_seconds": 45
}
```

### 7.2 Historical Position (PostgreSQL — persistent)

```sql
CREATE TABLE vehicle_positions (
    id              BIGSERIAL PRIMARY KEY,
    vehicle_id      VARCHAR(20) NOT NULL,
    route_id        VARCHAR(10) NOT NULL,
    trip_id         VARCHAR(50),
    geom            GEOMETRY(Point, 4326) NOT NULL,
    bearing         SMALLINT,
    speed_kmh       REAL,
    occupancy       VARCHAR(30),
    delay_seconds   INTEGER,
    recorded_at     TIMESTAMPTZ NOT NULL,
    ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vp_route_time ON vehicle_positions (route_id, recorded_at);
CREATE INDEX idx_vp_geom ON vehicle_positions USING GIST (geom);
```

### 7.3 Prediction Request/Response

```json
// Request
{
  "stop_id": "768",
  "route_id": "39A",
  "direction": 1,
  "timestamp": "2026-02-18T08:30:00Z"
}

// Response
{
  "predicted_arrival": "2026-02-18T08:37:22Z",
  "confidence": 0.87,
  "official_eta": "2026-02-18T08:40:00Z",
  "improvement_seconds": 158,
  "predicted_crowding": "SEATS_AVAILABLE",
  "model_version": "lgbm-v1.2"
}
```

---

## 8. Build Phases

### Phase 0 — Foundation ✅
- [x] Design document
- [x] Copilot instructions
- [x] UX Architecture (Nerve Centre, Glass Rail, 4 pillar modes, demo choreography)
- [x] Project scaffolding (monorepo structure)
- [x] Docker Compose for local dev (Postgres+PostGIS + Redis)
- [x] FastAPI backend skeleton (v1 routes, schemas, config)
- [x] Next.js Nerve Centre (Mapbox, PulseRing, PillarRail, VehicleMarkerLayer)
- [x] Ingestion service skeleton (GTFS-RT poller)
- [x] Frontend build verified ✓
- [ ] NTA API key acquisition started

### Phase 1 — Data Ingestion & Storage ✅
- [x] GTFS static parser (routes, stops, shapes, schedules)
- [x] GTFS-RT poller (vehicle positions, trip updates)
- [ ] PostgreSQL schema + PostGIS setup
- [x] Redis live state management
- [ ] Weather data poller (Met Éireann)
- [ ] Historical data accumulation begins

### Phase 2 — Live Visualisation (The Demo Winner) 🔄
- [x] Next.js app scaffold with Glass Rail design system
- [x] Mapbox GL integration (dark style, custom layers)
- [x] Nerve Centre single-canvas layout
- [x] Bottom glass rail pillar mode switcher
- [x] Pulse Ring (live fleet counter + stats, top-left)
- [x] Live bus markers with delay-based colouring
- [x] Route arteries from GTFS shapes.txt (116 routes)
- [x] Vehicle click → glass info card (route, delay, speed)
- [x] Data aging opacity on vehicle markers
- [x] Route labels at zoom ≥ 13
- [x] Active route highlight (glow on selection)
- [x] Ghost bus detection layer (stale data, optimise mode)
- [x] Bunching detection layer (same-route proximity, optimise mode)
- [x] Pillar mode switching (layers toggle per mode)
- [x] Connection status indicator (glass panel)
- [ ] Route arteries with flow particle animation
- [ ] Stop heartbeat pulse on arrivals
- [ ] Data & Viz: demand thermal heatmap + time scrubber
- [ ] Data & Viz: route hover cards + stop radial timeline
- [ ] Optimisation: split-screen time machine
- [ ] Collaboration: ripple effect for crowd reports + one-tap UI
- [ ] Smart Cities: multimodal journey ribbon + carbon badge
- [ ] Responsive: desktop Nerve Centre → mobile bottom sheet
- [ ] Demo sequence choreography (scripted 3-min walkthrough)

### Phase 3 — Predictive Engine
- [ ] Feature engineering pipeline (time, weather, day-type, stop sequence, historical delay)
- [ ] LightGBM arrival predictor — train + evaluate
- [ ] ONNX export + FastAPI serving endpoint
- [ ] A/B comparison: our predictions vs. GTFS-RT official
- [ ] Ghost bus detection logic
- [ ] Bunching detection + alerting

### Phase 4 — Collaboration & Crowdsourcing
- [ ] Crowding report UI (single-tap)
- [ ] Accessibility issue reporter
- [ ] Aggregation + display on map
- [ ] Community pulse feed

### Phase 5 — Smart Cities & Multimodal
- [ ] Dublin Bikes integration
- [ ] Luas real-time integration
- [ ] DART integration
- [ ] Multimodal journey planner engine
- [ ] Carbon savings calculator
- [ ] Open Data API (REST + WebSocket)

### Phase 6 — Polish & Submission
- [ ] Performance and load testing
- [ ] Mobile-responsive PWA
- [ ] Submission document / pitch deck
- [ ] Video demo recording
- [ ] Submit via Dublin Bus Innovation portal

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| ETA prediction accuracy vs official | ≥15% better MAE |
| Map load time (first contentful paint) | <1.5s |
| Live bus position update latency | <3s from source |
| Crowdsourcing reports in pilot | >500 in first month |
| API response time (p95) | <200ms |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| NTA API key delay | Blocks all data work | Apply immediately; meanwhile use public GTFS static + mock RT data |
| Insufficient historical data for ML | Weak predictions | Start collecting now; supplement with synthetic patterns from schedule data |
| Mapbox costs at scale | Budget overrun | Use free tier (50k loads/mo); fallback to MapLibre GL (open-source fork) |
| Challenge timeline pressure | Incomplete submission | Prioritise Phase 2 (visual demo) — it's what wins competitions |
| Scope creep | Diluted product | Each phase has a clear deliverable; ship sequentially |

---

## 11. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-18 | Project name: **BusIQ** | Short, memorable, implies intelligence. Domain-available check pending. |
| 2026-02-18 | Submit under Smart Cities pillar | Highest visibility (Smart Dublin partnership), spans all four pillars naturally. |
| 2026-02-18 | Monorepo structure | Single repo = simpler CI, atomic commits across frontend/backend. |
| 2026-02-18 | LightGBM first, Transformer later | Ship fast with LightGBM; upgrade model when we have enough data. |
| 2026-02-18 | FastAPI over Express/Django | Async-native, auto OpenAPI docs, Python ML ecosystem alignment. |
| 2026-02-18 | **"Nerve Centre" single-canvas UX** | Map IS the app. No page navigation. Pillar modes transform layers, not routes. Judges never lose spatial context. |
| 2026-02-18 | **Glass Rail design system** | Dark translucent panels float over the map. Never opaque. Map always visible. Control-room aesthetic. |
| 2026-02-18 | **Dark mode only** | Transit viz works best on dark backgrounds (contrast, eye strain, drama). No light mode — it dilutes the impact. |
| 2026-02-18 | **Inter as primary typeface** | Excellent tabular numeral support (critical for counters/stats). Variable weight. Free. |
| 2026-02-18 | **3-minute demo choreography designed** | Every second of the judge demo is scripted. First impression at 0:00, four pillar transitions, close at 2:45. |

---

## Appendix A: Key People

- **Billy Hann** — Dublin Bus CEO
- **Dr John McCarthy** — Director Innovation and Technical Services (likely judge / key stakeholder)
- **Barbara (Keane) O'Brien** — Technology Development Manager
- **Minister James Lawless TD** — Political sponsor

## Appendix B: Reference Links

- Dublin Bus Innovation Portal: https://www.dublinbus.ie
- NTA Developer Portal: https://developer.nationaltransport.ie
- Smart Dublin: https://smartdublin.ie
- GTFS Reference: https://gtfs.org
- GTFS-RT Reference: https://gtfs.org/realtime
- Met Éireann Open Data: https://www.met.ie/climate/available-data/historical-data
- Dublin Bikes API: https://developer.jcdecaux.com
- Luas API: https://luasforecasting.gov.ie
- Irish Rail API: http://api.irishrail.ie/realtime
