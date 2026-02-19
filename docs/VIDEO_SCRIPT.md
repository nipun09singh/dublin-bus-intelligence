# BusIQ Video Demo Script — 3-Minute Walkthrough

## Target: Dublin Bus Innovation Challenge judges
## Duration: 3:00 max
## Tone: Confident, data-driven, no filler

---

## 00:00–00:20 — THE HOOK (20 sec)

**[Screen: Live BusIQ map with 1,300+ moving buses]**

> "Right now, at this exact moment, Dublin Bus has a problem it can't see.
> Half its fleet is off schedule. 125 buses have gone dark — passengers
> are waiting for services that will never arrive. 230 pairs of buses
> are bunched together on 75 routes.
>
> This isn't a simulation. This is live. And BusIQ sees all of it."

**Action:** Show the PulseRing counter ticking up in real-time.

---

## 00:20–00:50 — THE MAP (30 sec)

**[Screen: Map zoomed to Dublin centre, buses colour-coded by delay]**

> "BusIQ ingests live GTFS-RT data from every bus in Dublin — Dublin Bus,
> Go-Ahead, Bus Éireann — 1,300+ vehicles across 268 routes. Every 15 seconds.
>
> Green means on-time. Yellow is a few minutes late. Red is severely delayed.
> You can already see the pattern — the red clusters on routes 40, 190, 64."

**Action:** 
1. Show delay colouring on map
2. Click a red bus → VehicleInfoCard pops up with delay details
3. Zoom to a bunched cluster

---

## 00:50–01:30 — THE INTELLIGENCE (40 sec)

**[Screen: Switch to Optimisation mode via PillarRail]**

> "But a map isn't enough. Dublin Bus already has maps. What they don't have
> is an intelligence layer that tells them what to DO about it."

**Action:** Click "Optimisation" on the PillarRail

> "Watch what appears. BusIQ has detected 230 bunching pairs and automatically
> generated 20 interventions. Each one is specific."

**Action:** Open CommandConsole. Show intervention list.

> "This one says: 'HOLD bus 2129 at Clonkeen Road for 180 seconds to restore
> 10-minute headway on Route E1.' It even estimates the passenger impact."

**Action:** Click an intervention → show details

> "A controller doesn't need to calculate anything. One click to approve.
> BusIQ tracks whether it worked."

---

## 01:30–02:00 — THE NETWORK HEALTH (30 sec)

**[Screen: Network Health panel]**

> "For management, there's one number: the Network Health Score.
> Right now it's 69 out of 100 — Grade C. That's driven by three factors:
> on-time performance at 50%, headway regularity, and ghost bus prevalence.
>
> Every intervention approved pulls this score up. Every ignored alert
> lets it decay. It creates accountability."

**Action:** Show the health score, then the GhostBusPanel

> "These 125 ghost buses? Passengers are standing at stops right now waiting
> for them. BusIQ flags every one and recommends deploying standby vehicles."

---

## 02:00–02:30 — PASSENGERS AS SENSORS (30 sec)

**[Screen: Switch to Collaboration mode]**

> "Here's the part that no one else is building. Passengers become part of
> the system. They report crowding — 'Bus 39A is packed, I can't board.'
>
> Three 'FULL' reports on the same route? BusIQ auto-generates a SURGE
> intervention — deploy extra capacity. The passenger gets notified:
> 'Your report triggered an extra bus.'
>
> That's not just a feature. That's trust."

**Action:** Show CrowdReportPanel → submit a report → show CommunityPulse feed

---

## 02:30–02:50 — SMART CITIES (20 sec)

**[Screen: Switch to Smart Cities, show multimodal + journey planner]**

> "BusIQ doesn't stop at buses. It integrates Luas, DART, and Dublin Bikes
> for multimodal journey planning. Take the Luas to avoid that bunched 39A.
> We even show the carbon savings."

**Action:** Quick journey plan → show CarbonBadge

---

## 02:50–03:00 — THE CLOSE (10 sec)

**[Screen: Back to full map view with all buses]**

> "BusIQ is live. It's processing real data. It works.
> We're asking Dublin Bus for access and time — not money.
> Six months to turn this prototype into a production operations tool
> for 159 million annual passengers.
>
> Thank you."

---

## RECORDING TIPS

1. **Use OBS Studio** (free) or Windows Game Bar (Win+G)
2. **Resolution:** 1920x1080, 30fps
3. **Browser:** Chrome fullscreen (F11) on localhost:3000
4. **Audio:** Record voiceover separately, overlay in editing
5. **Pre-warm:** Start the backend 5 min before recording so GTFS data loads
6. **Backup plan:** If live data is rate-limited, you can record in sections
7. **Export:** MP4, H.264, under 100MB for upload

## KEY MOMENTS TO CAPTURE

- [ ] PulseRing with live count (1300+)
- [ ] VehicleInfoCard on a delayed bus
- [ ] CommandConsole with real interventions
- [ ] GhostBusPanel showing signal-lost buses
- [ ] BunchingAlertPanel with severity badges
- [ ] CrowdReportPanel submitting a report
- [ ] Journey planner with multimodal result
- [ ] CarbonBadge showing savings
- [ ] Network Health Score (69/100, Grade C)
