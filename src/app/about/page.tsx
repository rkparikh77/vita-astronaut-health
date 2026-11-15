import { INDICATORS } from "@/core/indicators";
import { osdrSource } from "@/core/crew";
import { BODY_SYSTEMS, HAZARDS } from "@/core/types";
import { DataBadge, type Provenance } from "@/components/viz";

const PROVENANCE: { kind: Provenance; what: string; source: string; href?: string }[] = [
  { kind: "real", what: "Research lab: 118 blood analytes × 4 crew × 7 timepoints (3,300+ measurements), all statistics", source: "NASA OSDR OSD-569 & OSD-575, SpaceX Inspiration4", href: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575" },
  { kind: "real", what: "Each crew member's lab baselines: white cells, lymphocytes, hemoglobin, calcium, glucose and their lab reference ranges", source: "Inspiration4 preflight draws (L-92, L-44, L-3)", href: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569" },
  { kind: "live", what: "Solar particle events and M/X-class flares, last 30 days", source: "NASA DONKI (CCMC); refreshed every 30 min", href: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
  { kind: "live", what: "Hourly solar wind at L1: speed, density, dynamic pressure, magnetic field Bz; storm-driver level and shock detection", source: "NASA Wind spacecraft (SWE + MFI) via NASA SPDF CDAWeb HAPI; refreshed every 30 min, about a day behind real time", href: "https://cdaweb.gsfc.nasa.gov/" },
  { kind: "live", what: "Full-disk images of the Sun in four channels (corona, flares, chromosphere, magnetogram)", source: "NASA Solar Dynamics Observatory (AIA, HMI), latest images", href: "https://sdo.gsfc.nasa.gov/data/" },
  { kind: "real", what: "Vehicle exteriors in the Playground: ISS, Orion, surface habitat", source: "NASA 3D Resources (ISS B, Orion Capsule, Habitat Demonstration Unit)", href: "https://github.com/nasa/NASA-3D-Resources" },
  { kind: "real", what: "Mars base terrain: Jezero Crater elevation and color (relief exaggerated)", source: "NASA Mars Trek: MGS MOLA DEM and Viking MDIM 2.1 color mosaic tiles", href: "https://trek.nasa.gov/mars/" },
  { kind: "model", what: "Radiation dose, body odometer, mission projector, atlas", source: "MSL RAD, Chang'e-4 LND, ISS dosimetry, NASA-STD-3001, and the peer-reviewed studies cited on each card" },
  { kind: "sim", what: "Day-to-day in-flight vitals (heart rate, HRV, BP, sleep, mood…) and the four crew scenarios", source: "Seeded simulator on top of the real baselines, using published spaceflight effect sizes. Individual astronauts' daily in-flight vitals aren't publicly released (NASA LSDA restricts them), so this stands in for what a wearable would stream." },
];

export const metadata = { title: "Data & methods · VITA" };

export default function About() {
  const { mission, source } = osdrSource();
  return (
    <div className="mx-auto max-w-4xl pt-8">
      <p className="panel-title">Data & methods</p>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9]">Where every number comes from</h1>
      <p className="mt-4 text-ink-2">
        Every chart in VITA carries one of four badges. Here is exactly what each covers.
      </p>

      <section className="panel ticks mt-6 overflow-x-auto p-6">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="font-data text-left text-[10px] uppercase tracking-wider text-ink-3">
            <tr>
              <th className="py-2 font-normal">Badge</th>
              <th className="font-normal">What it covers</th>
              <th className="font-normal">Source</th>
            </tr>
          </thead>
          <tbody className="text-ink-2">
            {PROVENANCE.map((r) => (
              <tr key={r.what} className="border-t border-line align-top">
                <td className="py-3 pr-3">
                  <DataBadge kind={r.kind} />
                </td>
                <td className="py-3 pr-4 text-ink">{r.what}</td>
                <td className="py-3">
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noreferrer" className="text-nominal underline-offset-2 hover:underline">
                      {r.source}
                    </a>
                  ) : (
                    r.source
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel ticks mt-6 p-6">
        <h2 className="panel-title">How VITA was built · use of AI</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          <li>
            <b className="text-ink">Idea and requirements: the team.</b> We wrote our own requirements document (what to monitor, how, and how the system responds)
            before building; the <a href="/coverage" className="text-nominal hover:underline">Coverage page</a> traces each requirement to a feature.
          </li>
          <li>
            <b className="text-ink">Code: AI-assisted.</b> Much of the source code was written with Claude (Anthropic) as a coding assistant, directed, reviewed and tested by the
            team. Generated code is acknowledged here and in the README.
          </li>
          <li>
            <b className="text-ink">In the app:</b> the VITA Copilot runs on Claude and answers only through tools that read VITA&apos;s own data. Its answers are labeled as AI.
          </li>
          <li>
            <b className="text-ink">Images:</b> no AI-generated images or video. 3D models and terrain are NASA&apos;s; screenshots are of the app itself.
          </li>
        </ul>
      </section>

      <h2 className="font-display mt-12 text-4xl font-extrabold uppercase leading-[0.9]">How VITA decides</h2>

      <section className="panel ticks mt-8 p-6">
        <h2 className="panel-title">Three signals per indicator</h2>
        <ol className="mt-3 space-y-3 text-ink-2">
          <li>
            <b className="text-ink">1. Safety limits.</b> Fixed watch / action / critical limits from NASA-STD-3001, ADA and clinical
            early-warning ranges. Only these can raise a result to Action or Critical.
          </li>
          <li>
            <b className="text-ink">2. Your own baseline.</b> Lab values compare against the median of your real preflight blood draws.
            Daily vitals compare against your own last ~30 days in flight, so normal adaptation (like core temperature running ~1 °C
            higher in space) does not trigger alarms. A reading 2.5 standard deviations off your norm becomes Watch.
          </li>
          <li>
            <b className="text-ink">3. Trend.</b> A least-squares slope over the last 2 weeks (6 weeks for weekly labs). If the drift is
            larger than noise and would reach the action limit within 30 days, VITA flags it early.
          </li>
        </ol>
        <p className="mt-4 text-sm text-ink-3">
          Escalation then picks who should respond (you, the crew medical officer, or the flight surgeon), based on severity and the
          one-way light delay to Earth from the current location.
        </p>
      </section>

      <section className="panel ticks mt-5 p-6">
        <h2 className="panel-title">Data sources</h2>
        <ul className="mt-3 space-y-3 text-sm text-ink-2">
          {source.map((s) => (
            <li key={s.study}>
              <a className="text-nominal underline-offset-2 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                NASA OSDR {s.study}
              </a>{" "}
              · {s.panel === "CBC" ? "Complete blood count" : "Comprehensive metabolic panel"} for {mission}. Gives each simulated crew
              member real preflight white cells, lymphocytes, hemoglobin, calcium and glucose, plus that lab&apos;s reference ranges.
            </li>
          ))}
          <li>
            <a className="text-nominal underline-offset-2 hover:underline" href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noreferrer">
              NASA DONKI
            </a>{" "}
            · Live solar energetic particle events and M/X-class flares from the last 30 days, mapped onto the mission timeline as
            radiation dose events.
          </li>
          <li>
            Dose rates: MSL RAD cruise and Gale Crater (Zeitlin 2013, Hassler 2014), Chang&apos;e-4 LND lunar surface (Zhang 2020), ISS
            dosimetry. Career limit 600 mSv (NASA-STD-3001 Vol 1 Rev B).
          </li>
          <li>
            Spaceflight effects in the simulator: core temperature (Stahn 2017), sleep (Barger 2014), space anemia (Trudel 2022),
            calcium and bone (Smith 2015), immune change (Crucian 2018), SANS (Lee 2020), NASA Cognition PVT (Basner 2015).
          </li>
        </ul>
        <p className="mt-4 text-xs text-ink-3">
          Note: Inspiration4 serum glucose reads low at some timepoints (e.g. R+45), likely from sample handling. VITA clamps the glucose
          baseline to a plausible fasting range. Crew names are fictional; OSDR crew IDs are anonymized.
        </p>
      </section>

      <section className="panel ticks mt-5 p-6">
        <h2 className="panel-title">NASA&apos;s five hazards of human spaceflight</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(HAZARDS).map(([k, h]) => (
            <div key={k} className="rounded-lg border border-line p-3">
              <div className="font-semibold">{h.name}</div>
              <div className="text-sm text-ink-2">{h.blurb}</div>
              <div className="font-data mt-2 text-[10px] text-ink-3">
                {INDICATORS.filter((i) => i.hazards.includes(k as keyof typeof HAZARDS)).length} indicators track this
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel ticks mt-5 overflow-x-auto p-6">
        <h2 className="panel-title">All {INDICATORS.length} indicators</h2>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead className="font-data text-left text-[10px] uppercase tracking-wider text-ink-3">
            <tr>
              <th className="py-2 font-normal">Indicator</th>
              <th className="font-normal">System</th>
              <th className="font-normal">Input</th>
              <th className="font-normal">Watch</th>
              <th className="font-normal">Action</th>
              <th className="font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {INDICATORS.map((i) => (
              <tr key={i.id} className="border-t border-line align-top text-ink-2">
                <td className="py-2 text-ink">
                  {i.name} <span className="font-data text-ink-3">{i.unit}</span>
                </td>
                <td>{BODY_SYSTEMS[i.system].organ}</td>
                <td className="font-data text-xs">{i.input}</td>
                <td className="font-data text-xs text-watch">{band(i.thresholds.low?.watch, i.thresholds.high?.watch)}</td>
                <td className="font-data text-xs text-action">{band(i.thresholds.low?.action, i.thresholds.high?.action)}</td>
                <td className="text-xs text-ink-3">{i.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-6 text-center text-xs text-ink-3">VITA is a NASA Space Apps 2026 prototype. It is not a medical device.</p>
    </div>
  );
}

function band(lo?: number, hi?: number) {
  return [lo !== undefined ? `<${lo}` : null, hi !== undefined ? `>${hi}` : null].filter(Boolean).join(" · ");
}
