"use client";

import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, RotateCcw, Sparkles, Square, X, AlertTriangle } from "lucide-react";
import { getCrew } from "@/core/crew";
import { useMission } from "@/lib/store";

interface ToolChip {
  id: string;
  label: string;
  state: "running" | "ok" | "error";
  detail?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: ToolChip[];
  error?: { code: string; message: string };
}

function suggestions(path: string): string[] {
  const crewId = path.startsWith("/crew/") ? path.split("/")[2] : undefined;
  const name = crewId ? getCrew(crewId)?.name.split(" ")[0] : undefined;
  if (name)
    return [`What should ${name} do right now?`, `Explain ${name}'s readiness score`, `How has ${name}'s HRV changed this month?`, `Compare ${name}'s labs to their preflight baseline`];
  if (path.startsWith("/research"))
    return ["What changed most after landing?", "Is the IL-6 spike real or noise?", "Which panels show possible batch effects?", "Summarize recovery by R+82"];
  if (path.startsWith("/atlas")) return ["What would a Mars mission do to bone and radiation?", "What are the least-known effects of spaceflight?", "How does exercise change the projection?"];
  if (path.startsWith("/radiation")) return ["Is anyone close to their radiation limit?", "What's the space weather right now?", "How much dose would a major solar storm add here?"];
  if (path.startsWith("/link")) return ["Why does the link black out in March 2028?", "How should care change when Earth is 20 light-minutes away?", "Plan the crew's medical autonomy for the conjunction blackout"];
  if (path.startsWith("/sim")) return ["How do you survive a hull breach?", "Why can't a pulse oximeter detect carbon monoxide?", "Walk me through CPR in microgravity"];
  if (path.startsWith("/scan")) return ["How accurate is camera-based heart rate?", "What does voice reveal about fatigue?", "When should a camera reading be confirmed with a sensor?"];
  if (path.startsWith("/live")) return ["What does a falling HRV mean in flight?", "When should an arrhythmia go to the flight surgeon?", "Brief me on the crew's cardiac status"];
  return ["Give me a crew health briefing", "Who needs attention today and why?", "What changes if we're on Mars instead of the ISS?", "Which findings here use real NASA data?"];
}

export function Copilot() {
  const path = usePathname();
  const { env, entries, sepEvents, log } = useMission();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Auto-focus only with a mouse; on phones it would pop the keyboard before the user chooses to type.
    if (open && window.matchMedia("(pointer: fine)").matches) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      const history = [...msgs.filter((m) => !m.error && m.content), { role: "user" as const, content: q }];
      setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", tools: [] }]);
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

      try {
        const crewId = path.startsWith("/crew/") ? path.split("/")[2] : undefined;
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            context: { env, page: path, focusCrewId: crewId, entries, sepEvents, log },
          }),
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.type === "text") patch((m) => ({ ...m, content: m.content + ev.delta }));
            else if (ev.type === "tool")
              patch((m) => ({ ...m, tools: [...(m.tools ?? []), { id: ev.id, label: ev.label, state: "running", detail: describeInput(ev.input) }] }));
            else if (ev.type === "tool_done")
              patch((m) => ({ ...m, tools: (m.tools ?? []).map((t) => (t.id === ev.id ? { ...t, state: ev.ok ? "ok" : "error" } : t)) }));
            else if (ev.type === "error") patch((m) => ({ ...m, error: { code: ev.code, message: ev.message } }));
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, error: { code: "network", message: (e as Error).message } }));
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, msgs, path, env, entries, sepEvents, log],
  );

  // Other parts of the dashboard can open the copilot with a question (e.g. the live monitor's alarms).
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setOpen(true);
      if (q) setTimeout(() => sendRef.current(q), 60);
    };
    window.addEventListener("vita-ask", onAsk);
    return () => window.removeEventListener("vita-ask", onAsk);
  }, []);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-2.5 rounded-full border border-line-2 bg-panel/90 p-2.5 sm:py-2.5 sm:pr-4 sm:pl-3 md:right-5 md:bottom-5 shadow-2xl backdrop-blur-md transition hover:border-nominal/60"
          aria-label="Open VITA Copilot"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-nominal to-[#3987e5]">
            <Sparkles size={15} className="text-bg" />
            <span className="absolute inset-0 animate-ping rounded-full bg-nominal/30" style={{ animationDuration: "2.8s" }} />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Ask VITA</span>
          <kbd className="font-data hidden rounded border border-line-2 px-1.5 py-0.5 text-[10px] text-ink-3 sm:inline">⌘K</kbd>
        </button>
      )}

      {open && <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] sm:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 flex w-full flex-col border-l border-line bg-bg-2/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:w-[460px] ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
        aria-label="VITA Copilot"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-nominal to-[#3987e5]">
            <Sparkles size={16} className="text-bg" />
          </span>
          <div className="flex-1 leading-tight">
            <div className="font-semibold">VITA Copilot</div>
            <div className="font-data text-[10px] tracking-wider text-ink-3 uppercase">Claude Opus 5.5 · live mission data</div>
          </div>
          {msgs.length > 0 && (
            <button type="button" onClick={() => setMsgs([])} className="rounded-md p-1.5 text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label="New conversation" title="New conversation">
              <RotateCcw size={15} />
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label="Close copilot">
            <X size={16} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {msgs.length === 0 && (
            <div className="rise">
              <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
                Ask anything
                <br />
                <span className="text-ink-3">about this mission</span>
              </h2>
              <p className="mt-3 text-sm text-ink-2">
                Copilot reads the same data as the dashboard: every astronaut&apos;s indicators and scores, the real Inspiration4 blood statistics,
                cited research, mission projections and NASA space weather. It tells you which numbers are real, simulated or modeled.
              </p>
              <div className="mt-5 space-y-2">
                {suggestions(path).map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="block w-full rounded-xl border border-line bg-panel/60 px-4 py-3 text-left text-sm text-ink-2 transition hover:border-line-2 hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-bg">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                {!!m.tools?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.tools.map((t) => (
                      <span key={t.id} className="font-data inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10px] text-ink-2" title={t.detail}>
                        {t.state === "running" ? <Loader2 size={10} className="animate-spin" /> : t.state === "ok" ? <Check size={10} className="text-nominal" /> : <X size={10} className="text-critical" />}
                        {t.label}
                        {t.detail && <span className="text-ink-3">· {t.detail}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {m.content ? (
                  <div className="text-sm leading-relaxed text-ink">
                    <Markdown text={m.content} />
                  </div>
                ) : (
                  busy && i === msgs.length - 1 && !m.error && <ThinkingDots />
                )}
                {m.error && <ErrorCard err={m.error} />}
              </div>
            ),
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line-2 bg-panel px-3 py-2 focus-within:border-nominal/60">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about the crew, the data or the mission…"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
              aria-label="Message VITA Copilot"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="grid h-8 w-8 place-items-center rounded-full bg-ink-2 text-bg" aria-label="Stop">
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="grid h-8 w-8 place-items-center rounded-full bg-nominal text-bg transition disabled:opacity-30" aria-label="Send">
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="font-data mt-2 text-center text-[9px] tracking-wider text-ink-3 uppercase">Decision support only · not a medical device</p>
        </form>
      </aside>
    </>
  );
}

function describeInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as Record<string, unknown>;
  const parts = [o.crew_id, o.indicator, o.query, o.preset, o.timepoint, o.env].filter((x) => typeof x === "string") as string[];
  return parts.length ? parts.join(" · ") : undefined;
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-nominal" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function ErrorCard({ err }: { err: { code: string; message: string } }) {
  return (
    <div className="rounded-xl border border-watch/40 bg-watch/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-watch">
        <AlertTriangle size={14} /> {err.code === "not_configured" ? "Copilot isn't connected yet" : "Copilot couldn't answer"}
      </div>
      <p className="mt-1 text-ink-2">{err.message}</p>
      {err.code === "not_configured" && (
        <pre className="font-data mt-2 overflow-x-auto rounded-md bg-bg px-2 py-1.5 text-[11px] text-ink-2">echo &apos;ANTHROPIC_API_KEY=sk-ant-…&apos; &gt; .env.local</pre>
      )}
    </div>
  );
}

/** Small, safe Markdown subset: headings (###), bullets, numbered lists, **bold**, `code`, [links](https://…). No raw HTML. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`my-2 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-ink-3`}>
        {list.items.map((it, i) => (
          <li key={i}>
            <Inline text={it} />
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h)
      blocks.push(
        <h3 key={blocks.length} className="font-data mt-3 mb-1 text-[11px] tracking-[0.14em] text-ink-3 uppercase">
          <Inline text={h[1]} />
        </h3>,
      );
    else
      blocks.push(
        <p key={blocks.length} className="my-2">
          <Inline text={line} />
        </p>,
      );
  }
  flush();
  return <>{blocks}</>;
}

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={m.index} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={m.index} className="font-data rounded bg-panel-2 px-1 py-0.5 text-[12px]">{tok.slice(1, -1)}</code>);
    else {
      const lm = /^\[([^\]]+)\]\((.+)\)$/.exec(tok)!;
      parts.push(
        <a key={m.index} href={lm[2]} target="_blank" rel="noreferrer" className="text-nominal underline-offset-2 hover:underline">
          {lm[1]}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
