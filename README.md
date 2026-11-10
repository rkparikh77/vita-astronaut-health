# VITA — Vital Indicators & Telemetry for Astronauts

NASA Space Apps Challenge 2026 · **Create Health Monitoring Software for Astronauts on Space Missions**

VITA helps astronauts on long missions check their own health: log measurements on a daily protocol,
see status at a glance on an interactive body map, understand what each number means in space, and
know exactly what to do next and who to call, given how far they are from Earth.

## Highlights

- **Emergency playground (3D)** (`/sim`): walk into a two-module Mars-transit habitat and run a solar particle storm, hull breach, CO₂ scrubber failure, electrical fire or cardiac arrest. Physics and physiology run live (choked-flow decompression, hypoxia curve, metabolic CO₂, carbon monoxide fooling the pulse oximeter, Larsen 1993 resuscitation survival), crew avatars move through the 3D habitat, and a graded debrief explains every decision.
- **Medicine at the speed of light** (`/link`): a 3D solar system with REAL Earth and Mars positions (NASA/JPL Horizons) across a conjunction-class Mars mission launching in the real late-2026 window. Medical packets fly to Earth at light speed; live NASA Deep Space Network antennas; the mission's **17-day solar-conjunction blackout (13–30 March 2028)**, found from the ephemeris, during which the crew is fully on its own.
- **Hardware-free vitals** (`/scan`): heart rate from the phone camera (remote photoplethysmography) and a voice fatigue check, computed entirely on-device.

- **VITA Copilot (Claude Opus 5.5)**: an AI assistant on every page (⌘K) that queries live mission data through 9 tools: crew status, astronaut records, indicator history, the real Inspiration4 statistics, cited research, mission projections and NASA space weather. Streams answers with visible tool activity and always states what's real, simulated or modeled.
- **Live telemetry monitor** (`/live`): 250 Hz ECG, pleth and respiration on a bedside-style sweep display, beat-to-beat HRV, a stress index, and on-device detection of tachycardia, PVCs, AFib patterns and desaturation. **Connect a real Bluetooth heart-rate strap** (Web Bluetooth) to drive it from your own heartbeat.
- **Blood panel per astronaut**: real Inspiration4 clinical results across all seven draws, with reference-range bars and flight trajectories.

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
| [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Earth and Mars positions 2026–2029 (light time, conjunction blackout) |
| [NASA DSN Now](https://eyes.nasa.gov/dsn/dsn.html) | Live Deep Space Network antennas, targets, data rates, round-trip light time |
| NASA-STD-3001, MSL RAD, Chang'e-4 LND, HRP evidence | Limits, dose rates, spaceflight effects |

## Run it

```bash
npm install
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local   # enables VITA Copilot
npm run dev        # http://localhost:3000
npm test           # 92 unit tests: health engine, statistics, telemetry, deep-space link, emergencies, rPPG, copilot tools
npm run data       # re-download OSDR data into src/data/inspiration4.json
npm run ephemeris  # re-download Earth/Mars positions from JPL Horizons
npm run build && npm start
```

Deploy: push to GitHub and import on Vercel, or run `npx vercel` in this folder. Set `ANTHROPIC_API_KEY` in the Vercel project for the copilot; everything else needs no configuration. Web Bluetooth works in Chrome/Edge over HTTPS or localhost.

## On a phone or the iOS Simulator

VITA is an installable web app: on iPhone it runs full-screen from the home screen with its own icon, a bottom tab bar, and safe-area spacing for the notch and home bar.

- **Phone on the same Wi-Fi:** run `npm run dev:phone`, click **On phone** in the header and scan the QR code. In Safari tap **Share → Add to Home Screen**.
- **iOS Simulator:** `xcrun simctl boot "iPhone 14 Pro" && open -a Simulator`, then open `http://localhost:3000` in its Safari.
- **Anyone, anywhere:** deploy to Vercel and share the HTTPS link.

Web Bluetooth (heart-rate straps) isn't available in iPhone Safari; use Chrome on desktop or Android for that. Camera and microphone need HTTPS on a phone: use the deployed site.

## Structure

```
src/core/        Health engine (pure TypeScript, unit tested)
  indicators.ts  21 indicators: limits, guidance, sources
  assess.ts      thresholds + personal baseline + trend
  escalation.ts  who responds, aware of comms delay
  research.ts    t-tests, FDR, fold change, recovery, batch QC on real OSDR data
  scores.ts      Readiness / Sleep / Countermeasures + body odometer
  atlas.ts       cited findings + mission projector
  deepSpace.ts   JPL ephemeris, transfer arc, light time, conjunction blackouts, DSN parser, packet timing
  emergencies.ts emergency physics + physiology state machine with graded debriefs
  rppg.ts        camera heart rate (rPPG) and voice analysis DSP
  telemetry.ts   ECG/pleth synthesis, HRV beat generator, arrhythmia + desat detectors, BLE HR parser
  copilotTools.ts  the 9 data tools Claude can call, with Zod-validated inputs
  environments.ts, radiation.ts, simulator.ts, protocol.ts, gamification.ts, osdr.ts, crew.ts
src/app/         Pages: crew, astronaut self-check, live monitor, research lab, atlas, radiation, data; api/copilot (Claude streaming tool loop)
src/components/  BodyMap, TrendChart, ProtocolPanel, ReactionTest, …
scripts/         OSDR data pipeline
docs/            PLAN.md (design + phased plan), EVALUATION.md (gates and fixes)
```

Not a medical device. Built as a hackathon prototype.
