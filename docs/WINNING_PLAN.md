# VITA: plan to win NASA Space Apps 2026 (Philadelphia)

Event: Sat Nov 14, 9:00 AM to Sun Nov 15, 11:59 PM local. Judged on **Impact, Creativity, Validity, Relevance, Presentation**.
Target awards: Best Use of Space Data & Technology, Most Innovative, Best Youth-Led, Greatest Real-World Impact.

---

## 0. Settle the start-time rule first

The Philadelphia FAQ says project work may begin at 9:00 AM on Saturday, Nov 14, and that starting early can lead to disqualification.
VITA's commits are dated Nov 9 onward. Before the weekend:

- [ ] Post in Philadelphia Slack `#questions` (or email the local leads): explain that you prototyped before the event and ask how they want that handled.
- [ ] Do what they say. If they say rebuild, start a fresh repo at 9:00 AM Saturday and rebuild the strongest pieces (section 5 has a plan sized for that).
- [ ] Do not rewrite commit dates or squash history to hide it.

---

## 1. The story (one sentence judges remember)

> **On Mars, the doctor is 20 minutes away. VITA is the doctor that's already on board.**

Every screen should answer one question: *what does the crew do when Earth can't help in time?*

| Pillar | What judges see | NASA data behind it |
|---|---|---|
| Know your crew | Personal baselines, three-signal alerts, real Inspiration4 bloodwork | OSDR OSD-569 / OSD-575 |
| Feel the distance | Live Earth–Mars light time, conjunction blackout, DSN antennas | JPL Horizons, DSN Now |
| Watch the Sun | Live SDO Sun, L1 solar wind, flares and particle events | SDO, SPDF (Wind), DONKI |
| Rehearse the worst day | 3D emergencies inside real NASA vehicles and on real Mars terrain | NASA 3D Resources, Mars Trek |
| Ask for help | On-board AI flight surgeon that knows the crew and the comms delay | All of the above, through tools |

---

## 2. Design suggestions, ranked by payoff

### Must do (biggest lift for judging)

1. **Guided "Mission Mode" tour (Presentation, Creativity).** One button on the home page plays a 60–90 s scripted walkthrough: crew card → Tanaka's alert → the Sun right now → light-time delay → hull breach in the Orion exterior → AI flight-surgeon answer → debrief grade. Judges who click the link get the story without guessing. This also *is* the 30-second video when screen-recorded at 2× speed.
2. **"NASA data inside" status strip (Best Use of Space Data).** A slim bar under the header with a live dot per feed: OSDR · Horizons · DSN · DONKI · SPDF · SDO · Mars Trek · 3D Resources. Green = live, amber = cached, grey = offline. Clicking one jumps to the Data page row. This puts the main differentiator, eight NASA sources, on every page.
3. **Hero rewrite (Impact).** Replace the current home hero with the one-sentence story, a live counter ("Earth is 6 min 29 s away right now"), and two buttons: *Start Mission Mode* and *Run an emergency*.
4. **Close the loop from real data to emergency (Most Innovative).** On the Radiation page, add *"What if a CME shock hit right now?"*: it starts the solar-storm scenario seeded from the live solar-wind speed and the current mission day's light time. Real NASA data drives the simulation, not just a chart.
5. **Methods & Limits page (Validity).** One screen listing what's real vs modeled vs simulated, the 98 unit tests, the cited models (Larsen survival curve, CO₂ rise, choked-flow leak, IL-6 ×1.93 in 4/4 crew) and plain limits ("not a medical device", "vitals are simulated on real baselines"). Judges reward honesty about limits.

### Should do

6. **Two personas, two layouts.** Crew view on the phone (Today panel, the self-check scan, one big status) and flight-surgeon console on desktop (all crew, trends, research). Add a toggle in the header. This shows user-centered design, not just a dashboard.
7. **Debrief share card.** After an emergency, generate an image (grade, time-to-shelter, survival odds) the user can save. Judges remember things they can screenshot.
8. **Sound design for emergencies.** A master-alarm tone and a heartbeat that speeds with HR, muted by default with a speaker toggle. Cheap to add, and very effective in a demo video.
9. **Mars base emergencies.** Use the Jezero terrain as the scene for a surface EVA emergency (suit puncture or a fall, with the habitat 2 km away). The terrain is already loaded.

### Nice to have

10. **FHIR export of a crew record.** One button that downloads the crew member's labs and alerts as a FHIR bundle. It speaks the language of hospital IT, which helps the impact case for telemedicine on Earth.
11. **Moon Trek terrain for the lunar base** (same tile approach as Mars).
12. **Offline mode banner + cached feeds** so the demo survives venue Wi-Fi.

---

## 3. What judges score, and how VITA answers

| Criterion | What they ask | Our proof point | Gap to close |
|---|---|---|---|
| Impact | Who does this help? | Crews beyond low Earth orbit; also Antarctic stations, submarines, rural clinics with slow specialist access | Add the Earth-analog slide and one line on the home page |
| Creativity | Have we seen this before? | 3D emergencies in real NASA vehicles; light-time-aware AI flight surgeon; rPPG self-scan | Mission Mode tour; live data → emergency |
| Validity | Is it scientifically sound? | Real OSDR stats with FDR, cited physics models, 98 tests | Methods & Limits page |
| Relevance | Does it answer the challenge? | Monitoring, alerts, escalation, Earth-independent decisions | Say "Earth-independent medical operations" (NASA's own term) on the home page |
| Presentation | Is it clear and polished? | Consistent design system, phone + desktop, PWA | The 30-second video; tour mode |

---

## 4. The demo (submit ONE link: video *or* 7-slide deck)

**Recommendation: the 30-second video.** It is more memorable, and judges look at demos first. Keep the deck as a backup for live judging.

### 30-second video script

| Time | Shot | Voice-over (≤ 75 words total) |
|---|---|---|
| 0:00–0:02 | Title card: team name + "VITA" | "We're [team], and this is VITA." |
| 0:02–0:05 | Live light-time counter ticking | "On the way to Mars, Earth is up to 22 minutes away." |
| 0:05–0:10 | Crew grid → Tanaka's alert pulses | "VITA learns each astronaut's normal from real NASA crew data and flags what's off." |
| 0:10–0:15 | Live SDO Sun → solar wind charts | "It watches the Sun live through NASA SDO and SPDF." |
| 0:15–0:22 | Orion exterior turns red → cutaway hull breach → crew moving | "And it lets crews rehearse the worst day inside real NASA vehicles." |
| 0:22–0:27 | AI flight surgeon answer streaming | "An on-board AI flight surgeon decides when Earth can't." |
| 0:27–0:30 | Mars base on Jezero terrain + tagline | "VITA: the doctor that's already on board." |

Rules: ≤ 30 s, English (or English subtitles), **no one under 18 on camera or in an unmodified voice**, no NASA logos in generated visuals, public link (YouTube unlisted is fine; test it logged out).

### 7-slide deck (backup; the title slide counts)

1. Title: VITA, team names, challenge name, one-sentence story, hero screenshot
2. The problem: light-time delay, blackout, no evacuation; one chart
3. The user experience: crew phone view + flight-surgeon console
4. Rehearse the worst day: Playground screenshots (ISS / Orion / Mars base)
5. NASA data that makes it possible: the eight feeds, one row each
6. Validity: methods, tests, limits
7. Impact and what's next: Artemis, Mars, Earth analogs; open source

---

## 5. Weekend schedule (for a team of 4–6)

| When | Who | What |
|---|---|---|
| Sat 9:00–10:00 | All | Kickoff, read the final challenge page and Resources tab, confirm the NASA resource list, assign owners |
| Sat 10:00–14:00 | Eng ×2 | Must-dos 1–2 (Mission Mode, data status strip) |
| Sat 10:00–14:00 | Eng ×1 | Must-do 4 (live data → emergency) |
| Sat 10:00–14:00 | Design/story | Hero rewrite, Methods & Limits copy, slide outline |
| Sat 14:00–15:00 | All | Demo checkpoint: run the tour end to end |
| Sat 15:00–20:00 | Eng | Should-dos 6–8; bug fixes |
| Sat 15:00–20:00 | Story | Record a first video cut; write the submission text |
| Sun 9:00–13:00 | All | Freeze features at 13:00. Phone test, deploy to a public URL, test the link logged out |
| Sun 13:00–18:00 | Story | Final video, deck backup, submission page (summary, details, AI use, NASA data, references) |
| Sun 18:00–20:00 | Owner | **Submit for Judging** (aim 4 hours early), verify the banner, then only fix typos |

---

## 6. Submission checklist (Team Owner submits)

- [ ] Every member registered for Philadelphia and listed on the team (no adds after close)
- [ ] High-level summary: what, how it answers the challenge, why it matters
- [ ] Demo link: 30 s video or ≤ 7 slides, public, tested logged out
- [ ] Final project link: public deploy and/or public repo (the repo is private today)
- [ ] Project details: what it does, how, tools and languages
- [ ] Use of AI: Claude for code and copy; Claude Opus 5.5 inside the app as the copilot. Generated code acknowledged in README and the Data page; any AI-generated images watermarked
- [ ] NASA data: OSDR OSD-569/575, JPL Horizons, DSN Now, DONKI, SPDF CDAWeb (Wind), SDO, NASA 3D Resources, Mars Trek. Confirm at least one is on the challenge's own Resources tab
- [ ] References: papers cited in Atlas and Methods, open-source libraries
- [ ] No NASA logos or mission insignia in generated visuals
- [ ] Clicked **Submit for Judging** and saw the confirmation banner

---

## 7. Risks and fallbacks

| Risk | Fallback |
|---|---|
| DONKI down (it is today) | Already handled: "Offline" state; SPDF and SDO still live |
| Venue Wi-Fi fails during live judging | Pre-recorded video; 3D models and Mars terrain are bundled in `public/` |
| No API key for the copilot on the public deploy | Set `ANTHROPIC_API_KEY` in the host's environment; otherwise the copilot shows its not-configured card. Record the AI segment of the video locally |
| Large 3D assets slow on phones | Models load lazily; the Playground page's first load is 14 kB plus shared code |
| Rule question unresolved | Section 0 |
