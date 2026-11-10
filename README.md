# VITA — Vital Indicators & Telemetry for Astronauts

NASA Space Apps Challenge 2026 · **Create Health Monitoring Software for Astronauts on Space Missions**

VITA helps astronauts on long missions check their own health: log measurements on a daily protocol,
see status at a glance on an interactive body map, understand what each number means in space, and
know exactly what to do next and who to call, given how far they are from Earth.

## Highlights

- **Research lab on real astronaut blood**: 118 analytes × 4 crew × 7 timepoints from NASA OSDR, with a volcano plot, heatmap, per-crew trajectories, FDR-corrected stats, batch QC and CSV export.
- **Whoop/Oura-style daily scores**: Readiness, Sleep and Countermeasures rings with transparent contributors, plus HRV.
- **Body odometer**: radiation in chest X-rays, bone and muscle lost, spine growth, extra red cells destroyed.
- **Body-in-space atlas**: 12 cited findings most people never hear about, and a mission projector up to a Mars round trip.
- **Provenance on every chart**: Real data, Live feed, Model or Simulated.

- **Clickable body map**: 7 body systems, each colored by its worst indicator.
- **21 health indicators** across NASA's five spaceflight hazards: vitals, HRV, glucose, sleep, mood, stress, reaction time, exercise, hydration, vision (SANS), body mass, blood counts, calcium, cabin CO₂.
- **Three-signal assessment**: safety limits + personal baseline + trend projection.
- **Comms-delay-aware escalation**: self-care → crew medical officer → flight surgeon. On Mars (3–22 min delay) the crew is told to act autonomously.
- **Six mission environments**: ISS, Gateway, lunar base, lunar rover, Mars transit, Mars base. Each changes dose rate, gravity effects and comms delay.
- **Radiation dashboard**: career dose vs NASA's 600 mSv limit, live NASA DONKI solar events, and a solar-storm drill.
- **Built-in reaction-time test** (PVT), the fatigue measure NASA uses in flight.
- **Gamification**: XP, levels, streaks, badges for keeping to the protocol.

## Real data

| Source | Use |
|---|---|
| NASA OSDR [OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) | Inspiration4 complete blood count, 4 crew × 7 timepoints |
| NASA OSDR [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | Inspiration4 metabolic panel (glucose, calcium, …) |
| NASA OSDR [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | 71-plex serum cytokines and 9-plex cardiovascular proteins |
| [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) | Live solar particle events and flares |
| NASA-STD-3001, MSL RAD, Chang'e-4 LND, HRP evidence | Limits, dose rates, spaceflight effects |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 43 unit tests: health engine, statistics, scores, projections
npm run data       # re-download OSDR data into src/data/inspiration4.json
npm run build && npm start
```

Deploy: push to GitHub and import on Vercel, or run `npx vercel` in this folder. No environment variables needed.

## Structure

```
src/core/        Health engine (pure TypeScript, unit tested)
  indicators.ts  21 indicators: limits, guidance, sources
  assess.ts      thresholds + personal baseline + trend
  escalation.ts  who responds, aware of comms delay
  research.ts    t-tests, FDR, fold change, recovery, batch QC on real OSDR data
  scores.ts      Readiness / Sleep / Countermeasures + body odometer
  atlas.ts       cited findings + mission projector
  environments.ts, radiation.ts, simulator.ts, protocol.ts, gamification.ts, osdr.ts, crew.ts
src/app/         Pages: crew overview, astronaut self-check, research lab, atlas, radiation, data
src/components/  BodyMap, TrendChart, ProtocolPanel, ReactionTest, …
scripts/         OSDR data pipeline
docs/            PLAN.md (design + phased plan), EVALUATION.md (gates and fixes)
```

Not a medical device. Built as a hackathon prototype.
