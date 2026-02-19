# BusIQ — Dublin Bus Innovation Challenge Submission

## Elevator Pitch

BusIQ is a real-time operations co-pilot for Dublin Bus. It ingests live GTFS-RT data from 1,400+ vehicles across all operators, detects problems automatically — bunching, ghost buses, overcrowding — and generates specific, one-click interventions: "HOLD bus #352 at Phibsborough for 90 seconds to restore 10-minute headway." Not a dashboard. A decision engine.

---

## Challenge Being Addressed

**All four challenges**, with primary submission under **Data & Visualisation**.

BusIQ is a cross-cutting platform that spans all four pillars:
- **Data & Visualisation**: Real-time fleet visualisation with Network Health Score, delay colouring, route arteries, demand patterns
- **Optimisation**: Autonomous Intervention Engine generating HOLD/DEPLOY/SURGE recommendations with measurable impact estimates
- **Collaboration**: Passenger crowding reports feed directly into the intervention engine — passengers become operational sensors
- **Smart Cities**: Multi-operator integration (Dublin Bus, Go-Ahead, Bus Éireann), multimodal journey planning, carbon tracking

---

## The Background

Dublin Bus moves 159 million passengers per year across 116 routes with 1,100 buses. The network generates vast amounts of real-time data through GTFS-RT feeds — vehicle positions, trip updates, delay information — but this data flows through control rooms as raw numbers on screens. Between "seeing a problem" and "fixing it" is a cognitive gap that costs Dublin Bus millions in passenger trust and operational efficiency.

A controller sees two Route 39A buses bunched at Phibsborough. Now what? Calculating the optimal hold time to restore even headway requires mental arithmetic under pressure. Usually, they do nothing. A ghost bus appears — a scheduled service with no signal. The controller manually scans depot rosters, calls a supervisor, and by then 200 passengers have walked away.

BusIQ closes this gap. It doesn't just show the problem — it tells you what to do about it, right now, one click.

---

## The Need

Dublin Bus has data. What it lacks is an **intelligence layer** that converts that data into decisions.

Current pain points our prototype has already measured from live NTA data:
- **On-time performance at 49.3%** — at any given moment, half the fleet is more than 5 minutes off schedule
- **232 bunching pairs** detected simultaneously across 81 routes during Thursday evening peak
- **125 ghost buses** (9.5% of fleet) — signal-lost vehicles passengers wait for in vain
- **146 dead routes** — scheduled services with zero live buses operating
- **Network Health Score: 69/100** (Grade C) — indicating systemic headway irregularity and delay
- **Top 5 worst routes** (64, 190, 40, 55, 402) average 27-39 minutes of delay

These aren't hypothetical numbers. They come from our working prototype running against live NTA GTFS-RT data right now.

Dublin Bus needs a tool that:
1. Converts these numbers into **specific actions** (hold this bus, deploy that one)
2. Tracks whether those actions **worked** (intervention history with before/after)
3. Lets **passengers contribute** to the picture (crowding reports that trigger interventions)
4. Provides a **single health metric** that leadership can track daily

---

## Why Now

Three converging factors make this the right moment:

1. **BusConnects**: Dublin's bus network is being fundamentally redesigned. New routes, new frequencies, new patterns. The operational complexity is about to increase dramatically. An intelligent operations layer isn't a nice-to-have — it's infrastructure.

2. **NTA GTFS-RT maturity**: The National Transport Authority's real-time data feeds now cover all three Dublin operators (Dublin Bus, Go-Ahead Ireland, Bus Éireann) with vehicle positions, trip updates, and delay information. The data infrastructure exists. Someone needs to build on it.

3. **Passenger expectations**: Dubliners carry smartphones. They use Citymapper, Google Maps. They know when their bus is late. But they have no way to tell Dublin Bus about it, and Dublin Bus has no way to respond in real time. BusIQ bridges this gap.

---

## Value

### For Dublin Bus Operations
- **20 real-time HOLD interventions** generated automatically during a single live snapshot — each specifying the exact bus, stop, hold duration, and estimated passenger impact (e.g., "HOLD bus #2129 at Clonkeen Road for 180s to restore E1 headway")
- **Network Health Score** (0-100): a single metric that tells management "how healthy is my network RIGHT NOW" — currently Grade C (69/100), with clear component breakdown
- **Intervention history**: track what was approved, what happened after — evidence-based proof that interventions improve service

### For Dublin Bus Passengers (159M/year)
- **Crowd reports** that actually do something — "Your report triggered an extra bus on Route 39A" — passengers become operational sensors with visible impact
- **Real-time transparency**: see the network as it actually is, not as the timetable says it should be

### Measurable Outcomes
| Metric | How Measured | Target |
|--------|-------------|--------|
| Interventions approved per day | System log | 50+ |
| Average headway improvement from HOLD interventions | Before/after GPS comparison | 15% more regular |
| Crowd reports submitted daily | Database count | 500+ |
| Network Health Score improvement | Weekly average | +5 points in 3 months |
| Controller decision time | Time from alert to action | <30 seconds (from ~5 min manual) |

---

## Cost

**Cash funding request: €0**

BusIQ is built entirely on open data (NTA GTFS-RT) and open-source technology. The prototype runs on free-tier cloud infrastructure (Vercel + Railway/Render). We are not requesting cash funding.

**What we need from Dublin Bus:**
- Access to internal scheduling/rostering data (enhances ghost detection accuracy)
- 2-3 sessions with control room supervisors (validate intervention logic)
- Permission to pilot with one depot for 4 weeks (test DEPLOY interventions)
- A Dublin Bus contact for monthly progress check-ins

---

## Time

**Time request: 6 months to production-ready pilot**

| Month | Milestone |
|-------|-----------|
| 1 | Integration with Dublin Bus control room screens. Validate intervention logic with supervisors. |
| 2 | Pilot HOLD interventions on 3 routes with control room staff. Measure headway improvement. |
| 3 | Add DEPLOY interventions (ghost bus coverage). Connect to depot rostering system. |
| 4 | Launch passenger crowd reporting in controlled trial (500 users, 5 routes). |
| 5 | Full network rollout of all intervention types. Dashboard for management reporting. |
| 6 | Evaluation report with measured outcomes. Decision on permanent integration. |

---

## Maturity (TRL/BRL)

**Technology Readiness Level: TRL 6 — System prototype demonstrated in relevant environment**

BusIQ is not an idea or a concept. It is a working system processing live NTA GTFS-RT data in real time:
- 1,334+ vehicles tracked simultaneously across 3 operators (Dublin Bus, Go-Ahead, Bus Éireann)
- 414 routes resolved with human-readable names (10,255 stops, 227,980 trips mapped)
- Ghost detection, bunching detection, and intervention generation running against live data
- Full-stack: FastAPI backend + Next.js frontend + WebSocket real-time streaming
- The prototype is deployed and accessible via a live URL

This is significantly beyond concept stage. With Dublin Bus access and 6 months, it can be production-ready.

---

## Method

**Phase 1 (Months 1-2): Validate & Integrate**
- Workshop with Dublin Bus control room staff to validate intervention logic
- Integrate with existing control room display infrastructure
- Backtest interventions against 30 days of historical data to prove accuracy
- Establish baseline metrics (current average headway regularity, ghost rate, response time)

**Phase 2 (Months 2-4): Pilot HOLD & DEPLOY**
- Pilot HOLD interventions on Routes 39A, 15, and 77A (high-bunching routes)
- Pilot DEPLOY interventions from Broadstone depot (ghost bus coverage)
- Measure: headway improvement, controller decision time, passenger wait time reduction
- Iterate intervention parameters based on real outcomes

**Phase 3 (Months 4-5): Passenger Intelligence**
- Launch crowd reporting to 500 beta users via Progressive Web App
- Test crowd-to-intervention pipeline: 3+ FULL reports → auto-generate SURGE recommendation
- Measure passenger engagement rate and report accuracy vs ground truth

**Phase 4 (Month 6): Scale & Evaluate**
- Roll out to all routes and depots
- Produce evaluation report with measured outcomes against baseline
- Present recommendations for permanent integration

---

## Project Structure

- **Project Lead**: [Name] — full-stack engineer, built the prototype end-to-end
- **Dublin Bus Sponsor (requested)**: Control room supervisor for validation sessions
- **Update Cadence**: Bi-weekly progress reports. Monthly stakeholder review.
- **Communication**: Dedicated Slack/Teams channel with Dublin Bus contact

---

## Project Dependencies

**From Dublin Bus:**
- GTFS schedule data (beyond what's publicly available via NTA) — improves ghost detection
- Access to control room for 2-3 validation workshops
- Permission to pilot with one depot's standby roster
- Internal KPIs for current headway regularity and response times (baseline measurement)

**Third-party:**
- NTA GTFS-RT API (already integrated and working)
- Mapbox (mapping — free tier sufficient for pilot)
- Cloud hosting (Vercel + Railway — free tier sufficient)

---

## Project Outputs/Outcomes

### Tangible Outputs
1. **Production-ready BusIQ platform** accessible to Dublin Bus control room staff
2. **Intervention log** with every recommendation generated, approved/dismissed, and measured outcome
3. **Network Health Score dashboard** for management reporting
4. **Passenger crowd-reporting PWA** tested with 500+ Dublin commuters
5. **Evaluation report** with before/after metrics on headway, response time, and passenger satisfaction
6. **Open API** (27+ endpoints) available for integration with Dublin Bus's existing systems

### Indirect Outcomes
- **Operational efficiency**: Faster response to bunching, ghost buses, and overcrowding events
- **Passenger trust**: Visible proof that reports lead to action
- **Data-driven culture**: Shift from reactive to proactive operations
- **Smart city integration**: Platform ready for cross-modal coordination with Luas, DART, Dublin Bikes
- **Scalability**: Architecture designed for CIÉ Group-wide deployment (Bus Éireann already integrated in prototype)
