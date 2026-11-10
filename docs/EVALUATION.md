# VITA — Evaluation log

How each phase gate from [PLAN.md](PLAN.md) was checked, and what self-review changed.

## Phase gates

| # | Gate | Result |
|---|---|---|
| 1 | `npm run data` downloads OSDR CSVs; 4 crew × 7 timepoints | ✅ 4 crew × 7 timepoints × 38 analytes (CBC + CMP) |
| 2 | Core engine unit tests green | ✅ thresholds, baseline z-score, trend, escalation, radiation |
| 3 | Simulator deterministic; scenarios surface expected status | ✅ same seed → same output; each crew scenario flags the right indicator |
| 4 | `next build` passes; overview renders with no console errors | ✅ build, lint and typecheck clean; no console errors |
| 5 | Logging a low glucose turns the card red and shows guidance | ✅ 50 mg/dL → Critical, abdomen node red, Mars-specific autonomous steps, +15 XP, "First Light" badge |
| 6 | Mars transit raises dose; DONKI offline fallback is labeled | ✅ major unsheltered SEP drill → 30-day dose 175/250 mSv; "Offline" label + explanation |
| 7 | Phone width works | ✅ 375 px: no horizontal scroll; header no longer sticky on phones |
| 8 | Production build serves all routes | ✅ `npm run build && npm start` |

Final: **28 unit tests passing**, `tsc` clean, `eslint` clean.

## Findings from self-review, and fixes

| # | Found while | Problem | Fix |
|---|---|---|---|
| 1 | Inspecting real OSDR data | Crew C003 has a preflight lymphocyte outlier (6826/µL vs ~2100–3100) that skews a mean baseline | Baselines use the **median** of preflight draws |
| 2 | Inspecting real OSDR data | Hemoglobin reference range differs per crew (11.7 vs 13.2 g/dL) | Lab watch limits **personalized from each crew member's own lab reference range** |
| 3 | Inspecting real OSDR data | Serum glucose reads implausibly low at some timepoints (36–44 mg/dL at R+45), likely sample handling | Glucose baseline clamped to a plausible fasting range; noted on the About page |
| 4 | First simulated run | **Alarm fatigue**: 30+ flags across 4 crew, mostly normal spaceflight adaptation (core temp ~+0.8 °C) and noise | Daily vitals compare against a **rolling 30-day in-flight baseline**; trends must exceed 1.5 personal SDs over the window |
| 5 | First simulated run | Sleep watch at 6.5 h flagged everyone (in-flight average is ~6 h, Barger 2014) | Sleep thresholds set to 5.5 / 4.5 / 3 h |
| 6 | First simulated run | Glucose watch at 75 mg/dL was stricter than the clinical standard | ADA levels: watch <70, action <60, critical <54 |
| 7 | First simulated run | Integer scores (vision 0–3, stress 1–5) never crossed "strictly greater than" limits | Half-step limits (e.g. vision watch >0.5) |
| 8 | Engine review | Sort comparator in simulator was not a valid comparator | Explicit ordering (sleep first, then the rest) |
| 9 | Browser test | After logging, the detail panel stayed on the old indicator | Detail jumps to the most concerning value just logged |
| 10 | Browser test | Crew medical officer (Tanaka) was told to "call the crew medical officer" | Escalation routes to the **backup medical officer** when the patient is the CMO |
| 11 | Browser test | Watch guidance said "recheck in 3 days" then "recheck within 24 h" | Generic step changed to "VITA will prompt a recheck at your next check-in" |
| 12 | Phone-width test | Sticky header used ~25% of a phone screen | Sticky only at ≥640 px |
| 13 | Code review | Space key on a focused reaction-test button could count twice | Button uses `pointerdown`; keyboard handled once at window level |
| 14 | Browser test of reaction test | One slow trial dominated the mean (985 ms) | Score is the **median**; lapses (>500 ms) reported separately, as in PVT practice |

## Known limits

- In-flight vitals are simulated from published effect sizes; only lab baselines are real astronaut data.
- DONKI was unreachable from the build machine during development; the live path is implemented and labeled, and the drill exercises the same dose logic.
- Entries are stored per browser (localStorage). A flight version would sync to the vehicle's medical data system.
- Not a medical device. Thresholds come from public standards and need flight-surgeon review.

---

## Iteration 2 — research depth & wearable-grade UI

### What was added
- **Research lab** (`/research`): all 118 analytes NASA released for Inspiration4 (CBC, metabolic, 71-plex cytokines, 9-plex cardiovascular): volcano plot, per-crew trajectories, fold-change heatmap, whole-panel QC, CSV export.
- **Statistics engine** (`src/core/research.ts`): log₂ fold change vs each astronaut's own preflight median, exact Student-t p-values (regularized incomplete beta), Benjamini–Hochberg FDR, recovery residual, batch-shift detection.
- **Wearable scores** (`src/core/scores.ts`): Readiness / Sleep / Countermeasures (0–100) with transparent contributors; new **HRV** indicator.
- **Body odometer**: chest-X-ray-equivalent dose, bone and calf loss, spine lengthening, extra red cells destroyed, sunrises / round-trip light time.
- **Atlas** (`/atlas`): 12 verified findings with citations, onset timeline, and a phase-aware mission projector (ISS, lunar, Mars conjunction-class).
- **Provenance badges** on every chart: Real data / Live feed / Model / Simulated, with a full table on `/about`.

### Gates
| Gate | Result |
|---|---|
| Stats engine matches textbook values | ✅ t = 3.182, df = 3 → p = 0.0500; BH matches a hand-worked example |
| Real-data finding reproduces published result | ✅ IL-6 (1.93×) and IL-10 up in 4/4 crew at R+1, back to baseline by R+82 (SOMA, Nature 2024) |
| Unit tests | ✅ 43 passing |
| Every page, phone width | ✅ no horizontal scroll at 375 px on all 6 pages |
| Charts color-validated | ✅ crew series and diverging pair pass the CVD validator on the dark surface |

### Findings and fixes
| # | Problem | Fix |
|---|---|---|
| 15 | Cited the 9.4% "rounder heart" result to Hughson 2017; it's a 2014 NASA study (Thomas et al.) | Citation corrected after checking sources |
| 16 | Jugular-clot treatment detail comes from a separate case report | Cited Auñón-Chancellor 2020 (NEJM) alongside Marshall-Goebel 2019 |
| 17 | Mars mission modeled as 950 days in deep space | Projector uses phases: 200 d transit, 550 d surface, 200 d transit |
| 18 | Calf loss extrapolated linearly to −31% on Mars | Saturating model 20%·(1−e^(−d/173)), calibrated to −13% at 6 months |
| 19 | A tiny epsilon in the fold-change math gave 0.99999 instead of 1 | Removed (values are already guaranteed positive) |
| 20 | Smoothed curves overshot between real measurements | Measured trajectories drawn as straight segments |
| 21 | Volcano x-axis fixed at ±2.5 squeezed the data | Axis fits the data |
| 22 | Counters / rings depended on animation frames that pause in background tabs | Final values guaranteed by timers |
| 23 | Server/client float mismatch on timeline positions (hydration warning) | Positions rounded |
| 24 | Timeline labels collided | Lane-stacking layout with short names |
| 25 | Score rings overlapped on phones | Ring size adapts below 420 px |
| 26 | QC note claimed a pattern the numbers didn't show | Rewritten from the computed panel shifts |
| 27 | The Vercel deploy rebuilt `.next` under the running dev server (404 on `main-app.js`) | Stop the dev server before deploying |

### Honest limits of the research view
- n = 4. At p < 0.05, about 6 of 118 analytes are expected by chance; nothing survives FDR q < 0.1. The page says so.
- Cardiovascular and cytokine panels show whole-panel drift at late timepoints, flagged as possible batch effects.

---

## Iteration 3 — AI copilot, live telemetry, lab panels

### Added
- **VITA Copilot**: `/api/copilot` runs a streaming tool loop on Claude Opus 5.5 (adaptive thinking, effort `medium`, server-side refusal fallback, prompt caching on the stable system prompt and tools). 9 tools reuse the same engine as the UI; inputs are validated with Zod before running. The browser sends the astronaut's own entries and drills so answers match the screen.
- **Live monitor**: 250 Hz synthetic ECG (Gaussian PQRST, after ECGSYN), pleth and respiration; AR(1) RR generator tuned to each astronaut's HRV with respiratory sinus arrhythmia; detectors for tachy/brady, PVC, AF (nRMSSD screen) and desaturation; Web Bluetooth Heart Rate Service (0x180D / 0x2A37) with real RR intervals.
- **Blood panel**: per-astronaut real CBC/CMP results at all 7 Inspiration4 draws.

### Gates
| Gate | Result |
|---|---|
| Unit tests | ✅ 60 passing (17 new: copilot tools, telemetry, BLE parsing) |
| Generator reproduces target HR and RMSSD | ✅ HR 60–68 for target 64; RMSSD 35–70 for target 50 |
| AF injected → detected, no PVC double-report | ✅ checked across 52 windows |
| Copilot without a key | ✅ clear setup card, no crash |
| Copilot with a key | ⚠️ not run: no API key on this machine |

### Findings and fixes
| # | Problem | Fix |
|---|---|---|
| 28 | Channel separators redrawn every frame built up into solid white lines | Static overlay elements |
| 29 | During AF, random short-long intervals also triggered PVC alerts | Suppress ectopic alerts when the rhythm is irregular |
| 30 | One isolated PVC pushed nRMSSD over the AF threshold, hiding the PVC | Remove ectopic short-long pairs before the AF screen, as clinical screens do |
| 31 | Stray "… 2.ts" duplicate files in `.next` (iCloud Desktop sync) broke typechecking | Cleared the build cache; source tree verified clean |

---

## Iteration 4 — beyond dashboards: deep-space medicine, 3D emergencies, hardware-free vitals

### Added
- **Deep-space link** (`src/core/deepSpace.ts`, `/link`): Earth and Mars positions from JPL Horizons (2026-11-01 → 2030-01-01, 2-day step), mission plan in the real late-2026 window, transfer arc, light time, solar elongation, blackout detection, packet timing, NASA DSN Now parser and live route; R3F 3D solar system.
- **Emergency engine** (`src/core/emergencies.ts`, `/sim`): five scenarios with physics/physiology, decisions with delays, consciousness and survival models, graded debriefs; R3F habitat with avatars and effects.
- **rPPG + voice** (`src/core/rppg.ts`, `/scan`): resampling, band-pass, spectral peak with quality; autocorrelation pitch, variability, syllable rate, loudness, baseline comparison.
- Copilot tools: `get_deep_space_link`, `get_emergency_science`.

### Gates
| Gate | Result |
|---|---|
| Ephemeris matches Horizons' own observer range | ✅ 11.3 min Earth–Mars one-way on 2026-11-10 (1.358 AU) |
| Blackout found inside the surface stay | ✅ 13–30 Mar 2028, Sun within 0.81° |
| Each scenario rewards good decisions | ✅ tested: shelter vs delay, masks/evacuate/hatch vs nothing, CPR+AED vs late shock, extinguish, LiOH |
| rPPG recovers 54/72/96/128 bpm within 2 bpm from noisy jittery traces | ✅ |
| Unit tests | ✅ 92 passing |
| iPhone (iOS 16.2 simulator): playground, deep space, tab bar | ✅ |

### Findings and fixes
| # | Problem | Fix |
|---|---|---|
| 32 | Horizons JSON/CSV vector requests returned dates with no coordinates | Parse the default text format; km → AU |
| 33 | Expected CO₂ to rise tens of mmHg/hour; physics says 0.38 mmHg/h (4 crew, 185 m³) | Kept the physics; the scenario became a realistic slow-burn emergency with a faster clock |
| 34 | Cardiac survival docstring was garbled and the model approximate | Implemented Larsen 1993 exactly: 67% − 2.3%/min to CPR − 1.1%/min to shock − 2.1%/min to ALS |
| 35 | "Finish tasks first" delayed shelter only 30 min, missing the proton peak | One-hour delay that runs through the peak |
| 36 | Do-nothing hull breach left crew conscious after an hour: correct for a 2 cm hole (τ ≈ 82 min) | Scenario uses a 4 cm debris strike (τ ≈ 20 min) |
| 37 | Simulation clock froze when the browser paused animation frames | Physics on a 20 Hz timer; 3D still renders on frames |
| 38 | On iOS < 16.5, Tailwind v4's nested @supports translucent colors fell back to solid fills (unreadable red alarm bar) | Unlayered rgba equivalents for every translucent color in use |
| 39 | Nine sections don't fit a five-tab bar | Crew · Live · Playground · Deep Space · More (sheet) |

### Honest limits
- The crew vehicle's path between planets is an approximate transfer arc, not a trajectory solution.
- Emergency physiology is a teaching model calibrated to published numbers, not a validated medical simulator.
- Camera heart rate and voice fatigue are experimental screening signals; validate against a sensor before acting.
- Copilot still untested live: no API key on the build machine.
