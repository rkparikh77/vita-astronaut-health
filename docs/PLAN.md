# VITA — Vital Indicators & Telemetry for Astronauts

NASA Space Apps 2026 · *Create Health Monitoring Software for Astronauts on Space Missions*

## 1. The challenge (summarized)

Long missions expose crews to NASA HRP's five hazards: **radiation, isolation & confinement,
distance from Earth, altered gravity, hostile closed environment**. These drive immune change,
bone loss, cardiovascular events, poor nutrition and behavioral health problems. Far from Earth,
astronauts must assess themselves. Build a **visual tool** that gathers health indicators
(BP, HR, glucose, temperature, sleep, mood …) and helps astronauts **evaluate and act**.

Judged extras the brief calls out, and where VITA covers them:

| Brief asks for | VITA feature |
|---|---|
| Clickable human figure per body part | Interactive body map (7 systems) colored by status |
| Different environments (station, rover, Moon, Mars) | Mission environment switch: changes radiation rate, comms delay, gravity effects, escalation rules |
| Prompts to take measurements on a routine | Daily protocol checklist with due/overdue state |
| Gamification | XP, streaks, badges for completing protocol and the reaction-time test |
| Dynamic charts over time | Per-indicator trend charts with baseline band and threshold lines |
| Color coding at a glance | Nominal / Watch / Action / Critical everywhere |
| Simple instructions & explanations | Every indicator has "How to measure", "Why it matters in space", "What to do" |
| When to call the flight surgeon | Escalation engine, aware of the comms delay to Earth |

## 2. Data sources

| Source | What we use | Access |
|---|---|---|
| NASA OSDR **OSD-569** (Inspiration4 CBC) | Real white cell, lymphocyte, hemoglobin, platelet values for 4 crew at L-92, L-44, L-3, R+1, R+45, R+82, R+194 | Public CSV, fetched by `npm run data` |
| NASA OSDR **OSD-575** (Inspiration4 CMP) | Real glucose (mg/dL), calcium, creatinine, electrolytes for the same crew | Public CSV |
| NASA **DONKI** (CCMC) | Live solar energetic particle (SEP) + flare events → radiation alerts | Live API at runtime, labeled drill mode if unreachable |
| MSL **RAD** (Zeitlin 2013; Hassler 2014), Chang'e-4 **LND** (Zhang 2020), ISS dosimetry | Dose rates per environment | Published constants, cited in code |
| **NASA-STD-3001** Vol 1 & 2 | Career dose limit (600 mSv), cabin CO₂ limit, vital-sign thresholds | Published constants |
| NASA **HRP** evidence (bone loss ~1–1.5%/mo, SANS, sleep ~6 h, behavioral health) | Simulator effect sizes and guidance text | Published literature |

Pre-flight Inspiration4 values become each crew member's **personal baseline**; the in-flight
simulator then applies published spaceflight effects so the demo shows realistic drift.

## 3. Architecture (modular)

```
src/
  core/                 pure TypeScript, no React — fully unit tested
    indicators.ts       registry: units, thresholds, body system, hazards, guidance
    assess.ts           status from thresholds + personal baseline z-score + trend
    escalation.ts       self-care → crew medical officer → flight surgeon, comms-delay aware
    environments.ts     ISS, Gateway, lunar base, rover, Mars transit, Mars surface
    radiation.ts        cumulative dose, SEP boosts, limit tracking
    simulator.ts        seeded deterministic crew time series
    protocol.ts         daily measurement schedule and due state
    gamification.ts     XP, streaks, badges
    osdr.ts             parse Inspiration4 CSV → baselines
  data/                 generated JSON from OSDR (committed so builds are offline)
  app/                  Next.js App Router UI
    page.tsx            Crew overview (mission control)
    crew/[id]/page.tsx  Astronaut self-check: body map, indicators, trends, check-in, PVT
    radiation/          Dose dashboard + live DONKI feed
    about/              Methods, data provenance, disclaimers
    api/space-weather   DONKI proxy with cache + graceful fallback
  components/           BodyMap, StatusPill, TrendChart, CheckInForm, ReactionTest …
scripts/fetch-osdr.ts   data pipeline
```

## 4. Iterative build plan with acceptance checks

Each phase ends with an evaluation gate. Do not start the next phase until the gate passes.

| # | Phase | Deliverable | Gate (how it is evaluated) |
|---|---|---|---|
| 1 | Data pipeline | `npm run data` downloads OSDR CSVs → `src/data/inspiration4.json` | Script runs; JSON has 4 crew × 7 timepoints; unit test parses fixture |
| 2 | Core engine | indicators, assess, escalation, radiation, environments | `npm test` green; edge cases: thresholds, missing baseline, comms delay |
| 3 | Simulator + protocol + gamification | Deterministic 180-day mission per crew with scenario injection | Same seed → same output; scenario produces expected Action status |
| 4 | UI shell + crew overview | Mission-control page, color-coded crew cards | `next build` passes; page renders in browser, no console errors |
| 5 | Astronaut self-check | Body map, indicator detail, trend charts, check-in form, PVT test | Manual browser run: enter a low glucose → card turns red and guidance shows |
| 6 | Radiation + space weather | Dose gauge, environment switch, DONKI feed | Switching Mars transit raises dose rate; offline fallback labeled |
| 7 | Self-review & iterate | Code review pass, UX pass at phone width, fix findings | Findings list in `docs/EVALUATION.md`, each fixed or justified |
| 8 | Deploy-ready | README, Vercel config, production build | `npm run build && npm start` serves all routes |

## 5. Safety framing

VITA is a decision-support prototype. Thresholds come from public standards, but it is not a
medical device; the UI always routes Action/Critical results to the crew medical officer or
flight surgeon.
