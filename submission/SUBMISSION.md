# VITA: NASA Space Apps 2026 submission package

Deadline: **Sunday, November 15, 2026, 11:59 PM Eastern (Philadelphia).** Aim to click **Submit for Judging** by 8:00 PM.
Where: spaceappschallenge.org → profile icon → **My Team** → **Project** tab → **Edit**. Save often (Save Progress). Turn the edit **Lock** on while editing.

Team **Quakernauts**: Rahil Parikh, Lana Atiya, Jahnavi Prudhivi, Cynthia Zhang, Joshua Wu.

**Final links (tested logged out, Nov 15):**
- Demo (7-slide deck): https://vita-quakernauts.vercel.app/vita-demo-deck.pdf
- Final project (live app): https://vita-quakernauts.vercel.app

---

## 0. Before you submit (do these first)

| # | Task | Who | Done |
|---|---|---|---|
| 1 | Message the Philadelphia Local Lead about pre-event prototyping (draft in section 9) and follow their answer | Team owner | ☐ |
| 2 | Every member registered for the **Philadelphia** Local Event (not waitlisted) and listed on the team page | Each member | ☐ |
| 3 | App published at https://vita-quakernauts.vercel.app and tested logged out | Done | ☑ |
| 4 | Deck PDF public at https://vita-quakernauts.vercel.app/vita-demo-deck.pdf | Done | ☑ |
| 5 | Team and member names on the deck; PDF re-exported (7 pages) | Done | ☑ |
| 6 | Nobody under 18 appears or is heard (unmodified) in the demo | Storyteller | ☐ |
| 7 | Tick both boxes on the form (Terms; original work with all resources referenced), then **Submit for Judging** and see the green banner | Team owner | ☐ |

---

## 1. Project Name

**VITA: the doctor already on board**

## 2. High-Level Project Summary

> VITA is crew health monitoring software for missions where Earth can't help in time. On the way to Mars a message to the flight surgeon takes up to 20 minutes each way, the radio goes dark for weeks at solar conjunction, and nothing can be resupplied for nearly three years. VITA learns each astronaut's own normal from real NASA crew bloodwork (Inspiration4, NASA OSDR), watches vitals, sleep, mood, radiation dose and the cabin, and flags change using safety limits, personal baselines and trends together. It knows the comms delay and tells the crew when to act on their own. It checks every medicine against the astronaut's allergies, conditions and other drugs before it is taken, runs private mental-health check-ins that the astronaut controls, watches the Sun live through NASA SDO, SPDF and DONKI, and lets crews rehearse emergencies (hull breach, fire, CO₂, solar storm, cardiac arrest) inside real NASA vehicle models and on real Mars terrain. An on-board AI flight surgeon answers questions from VITA's own data. It matters because NASA's next missions need Earth-independent medicine, and the same tools help anyone far from a doctor on Earth.

## 3. Link to Project Demo

https://vita-quakernauts.vercel.app/vita-demo-deck.pdf  (provide only this one; don't also add a video)
- Deck: `submission/VITA-demo-deck.pdf` (7 slides including the title slide; within the limit).
- Video: script in `submission/VIDEO_SCRIPT.md` (must be 30 seconds or less).

## 4. Link to Final Project

https://vita-quakernauts.vercel.app

Source code: the GitHub repo is private. Add its link here only if the team makes it public.

## 5. Detailed Project Description

**What it does**

VITA is a web app (works on desktop and phones, installable like an app) with two points of view: the flight surgeon or crew medical officer watching the whole crew, and each astronaut checking themselves.

- **Knows each astronaut's normal.** Lab baselines come from the real preflight blood draws of the four Inspiration4 crew (NASA OSDR OSD-569 and OSD-575). 21 indicators (heart rate, HRV, blood pressure, SpO₂, glucose, sleep, mood, stress, reaction time, exercise, hydration, vision, body mass, blood counts, calcium, cabin CO₂ and more) are assessed with three signals at once: safety limits, deviation from the person's own rolling baseline, and the trend toward a limit. That avoids alarm fatigue and catches slow drift.
- **Personal factors change the rules.** Each astronaut has a medical profile (allergies, conditions, current medicines, dormant viruses, prior flights and dose, diet, fitness). For example, a crew member with known mild hypertension gets a personal blood-pressure range, so normal-for-him readings don't alarm.
- **Comms-delay-aware escalation.** Who responds (self-care → crew medical officer → flight surgeon) depends on where the crew is. When the patient *is* the crew medical officer, care passes to the backup. Earth–Mars light time and the March 2028 solar-conjunction blackout are computed from real NASA/JPL Horizons ephemeris; the live NASA Deep Space Network feed shows which antennas are talking to which spacecraft.
- **Onboard pharmacy.** Every dose is checked before it is taken: allergies (hard stop with a safer alternative), interactions with current medicines and anything taken in the last 24 h, cautions for conditions, expiry and stock. Side effects are asked about after each dose and flagged for review, as is heavy sleep-aid use. A shelf-life chart shows which medicines expire before the crew is home (on a 1,008-day Mars mission, all of them do).
- **Private wellbeing check-in.** Standard PHQ-2 and GAD-2 screens plus sleep quality, crew cohesion and workload. Private by default; the astronaut chooses to share nothing, scores only, or everything. Only a flag is sent automatically, and only when a serious-risk threshold is crossed. It suggests coping tools (guided breathing, sleep hygiene, workload changes, recorded family messages sized to the comms delay) and lets the astronaut request an earlier private conference.
- **Radiation and space weather.** Per-astronaut dose against NASA's 600 mSv career limit (including prior flights), live solar flares and particle events (NASA DONKI), live hourly solar wind with interplanetary-shock detection (NASA Wind via SPDF CDAWeb), the Sun right now in four channels (NASA SDO), and a solar-storm shelter drill.
- **Live bedside monitor.** Real-time ECG, pulse-oximetry and respiration waveforms with beat-to-beat HRV, atrial-fibrillation, PVC and desaturation detection; a Bluetooth heart-rate strap can drive it.
- **Camera and voice self-check.** Heart rate from a phone camera (remote photoplethysmography) and voice-based fatigue cues, computed on the device.
- **Emergency playground.** 3D emergencies (hull breach, CO₂ scrubber failure, fire, solar particle storm, cardiac arrest) with live physics and physiology: choked-flow leak rates, CO₂ rise, carbon monoxide fooling the pulse oximeter, survival odds from published cardiac-arrest data. Vehicles are NASA's own 3D models (ISS, Orion, Habitat Demonstration Unit) and the Mars base sits on real Jezero Crater terrain from NASA Mars Trek. A debrief grades every decision.
- **Research lab.** All 118 analytes from the Inspiration4 panels with paired tests, false-discovery-rate correction, fold changes and recovery. For example, IL-6 rose 1.93× in all four crew the day after landing and recovered by R+82.
- **AI flight surgeon (VITA Copilot).** Claude, answering only through tools that read VITA's own data (crew records, labs, space weather, comms link, emergency science, medication checks). It never sees private check-ins.
- **Requirements coverage.** Our team's requirements document (8 core risks, 9 additional factors, 12 personal factors) is traced on the `/coverage` page to the feature that meets each item: 26 of 37 built, 5 partial, 6 not yet.

**How it works.** Next.js 15 and React 19 with TypeScript. The health engine (`src/core/`) is pure TypeScript with 114 automated tests. Live NASA feeds are fetched server-side and cached; NASA 3D models and Mars Trek tiles are bundled so the app works offline. 3D uses Three.js through React Three Fiber. Charts use Recharts. The copilot streams from the Claude API with Zod-validated tool inputs.

**Benefits.** It turns months of physiological data into the decision a crew must make right now, without Earth. It respects privacy for mental health. It is honest about provenance: every chart is labeled Real data, Live feed, Model or Simulated.

**What we hope to achieve.** A blueprint for Earth-independent medical operations on Artemis and Mars missions, and a tool for places on Earth where help is far away: Antarctic stations, submarines, ships and rural clinics.

**Development timeline (disclosure).** Our team prototyped the core of VITA in the week before the event (git history from November 9, 2026), while learning the tools and NASA data. On November 12 we added NASA 3D models, Mars Trek terrain and the SDO and SPDF space-weather feeds. During the hackathon (November 14–15) we added the onboard pharmacy with medication-safety checks, the private wellbeing check-in with consent controls, per-astronaut medical profiles that change warning ranges, the requirements-coverage page, a medication tool for the AI copilot, and the demo deck. The full commit history is available in our repository (shared on request).

**Limits.** Not a medical device. Day-to-day in-flight vitals are simulated on top of the real baselines, because individual astronauts' in-flight data are not publicly released. The medication rule set is illustrative, not clinical.

**Tools and languages.** TypeScript, Next.js, React, Tailwind CSS, Three.js / React Three Fiber / drei, Recharts, Zod, Vitest, Anthropic Claude API, Web Bluetooth, Web Audio, getUserMedia.

## 6. Use of Super Intelligence (SI)

> Yes. The idea and the requirements are our team's own: we wrote a requirements document (what to monitor, how, and how the system responds for each NASA spaceflight hazard) before building, and the app's Coverage page traces each requirement to a feature. We used Claude (Anthropic) as an AI coding assistant to write much of the source code, directed, reviewed and tested by the team; this is acknowledged in the README and on the app's Data page. Inside the app, the VITA Copilot uses Claude to answer questions through tools that read VITA's own data, and its answers are labeled as AI. We did not use AI to generate images, video or audio; the 3D models and terrain are NASA's and the screenshots are of the app. No NASA logos or mission insignia were generated or modified.

## 7. NASA Data

| NASA resource | How VITA uses it |
|---|---|
| NASA OSDR **OSD-569**, Inspiration4 complete blood count: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 | Each astronaut's personal lab baselines and reference ranges |
| NASA OSDR **OSD-575**, Inspiration4 metabolic panel, 71-plex cytokines, 9-plex cardiovascular: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 | Baselines; research lab with 118 analytes, paired tests and FDR |
| NASA/JPL **Horizons** ephemeris: https://ssd.jpl.nasa.gov/horizons/ | Earth and Mars positions 2026–2029: message delay and the conjunction blackout |
| NASA **DSN Now**: https://eyes.nasa.gov/dsn/dsn.html | Live Deep Space Network antennas, targets and data rates |
| NASA **DONKI** (CCMC): https://kauai.ccmc.gsfc.nasa.gov/DONKI/ | Live solar flares and solar particle events |
| NASA **SPDF CDAWeb** (Wind SWE and MFI): https://cdaweb.gsfc.nasa.gov/ | Live hourly solar wind, storm level and shock detection |
| NASA **SDO** (AIA, HMI): https://sdo.gsfc.nasa.gov/data/ | Latest full-disk Sun images in four channels |
| **NASA 3D Resources**: https://github.com/nasa/NASA-3D-Resources | ISS, Orion and Habitat Demonstration Unit models in the emergency playground |
| NASA **Mars Trek** (MOLA DEM, Viking MDIM 2.1): https://trek.nasa.gov/mars/ | Jezero Crater elevation and color for the Mars base |
| **NASA-STD-3001** and the Human Research Program evidence reports | Limits and the spaceflight hazards the indicators cover |

## 8. Space Agency Partner Data and Other References

**Partner data:** None used.

**Open-source software:** Next.js 15.5, React 19.1, Tailwind CSS 4, Three.js 0.171, @react-three/fiber 9, @react-three/drei 10, Recharts 2.15, lucide-react, Zod 3, qrcode, Vitest, tsx, @anthropic-ai/sdk. Fonts: Big Shoulders, Inter and JetBrains Mono (Google Fonts, SIL Open Font License).

**AI service:** Anthropic Claude API (VITA Copilot).

**Scientific references (cited in the app):**
- Mason et al., SOMA package (Inspiration4), Nature 2024; Trudel et al. 2022, Nature Medicine (space anemia)
- Garrett-Bakelman et al. 2019, Science (NASA Twins Study)
- Crucian et al. 2018 (immune dysregulation); Mehta et al. (latent virus reactivation, NASA JSC)
- Smith et al. 2015 and NASA nutritional biochemistry; Gabel et al. 2022, Scientific Reports (bone)
- Trappe et al. 2009, J Appl Physiol (muscle); Chang et al. 2016, Spine
- Lee et al. 2020, npj Microgravity (SANS); Marshall-Goebel et al. 2019, JAMA Network Open
- Barger et al. 2014, Lancet Neurology (sleep); Basner et al. 2015 (NASA Cognition, PVT)
- Thomas et al., NASA, ACC 2014 (heart shape); Otsuka et al. 2016–2018 (ISS HRV)
- Stahn et al. 2017, Scientific Reports (body temperature)
- Zeitlin et al. 2013, Science (MSL RAD cruise dose); NASA-STD-3001 Vol 1 and 2 (Rev C, 2022)
- Larsen et al. 1993, Ann Emerg Med (cardiac-arrest survival vs time to CPR and defibrillation)
- Du et al. 2011, AAPS Journal (medicines flown on the ISS)
- Kroenke et al. 2003 (PHQ-2) and 2007 (GAD-2)
- ADA Standards of Care (glucose); AHA blood-pressure ranges

---

## 8b. Publishing the app (Final Project link)

Pick one:

**A. Vercel (recommended, free).** Gives a public HTTPS link, which the camera and microphone features need on phones.
```bash
cd vita && npx vercel@latest --prod
```
Log in when asked, accept the defaults, then in the Vercel dashboard add `ANTHROPIC_API_KEY` under Project → Settings → Environment Variables (optional; without it the copilot shows a "not configured" card) and redeploy. Test the URL in a private window.

**B. Public GitHub repo.** Change the repository's visibility to public (Settings → General → Danger Zone). Judges can read the code and README but can't click through the app, so use this *with* option A.

Optional: request a FortiGuard web-filter classification for the deployed URL so judges' networks don't block it.

---

## 9. Message to the Philadelphia Local Lead (send on Slack `#questions` or by email)

> Hi! Our team (Quakernauts, Create Health Monitoring Software for Astronauts on Space Missions) wanted to be upfront: we started prototyping our project, VITA, in the week before the event while learning the tools and NASA datasets. During the hackathon we've built on it substantially (onboard pharmacy and medication-safety checks, private wellbeing check-ins, personalized medical profiles, a requirements-coverage page). Our full commit history is available. Is it OK to submit, and is there anything you'd like us to note or change in the submission? Thank you!
