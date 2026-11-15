import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ContextSchema, runTool, TOOL_DEFS, TOOL_LABELS, type ToolName } from "@/core/copilotTools";
import { MISSION } from "@/core/crew";
import { ENV_MAP } from "@/core/environments";
import { fetchSpaceWeather } from "@/lib/spaceWeather";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

// Stable system prompt: kept byte-identical across requests so it caches.
const SYSTEM = `You are VITA Copilot, the health intelligence assistant inside VITA, a crew health monitoring system for long-duration NASA missions. Your users are astronauts, the crew medical officer, flight surgeons, and NASA researchers.

How to work:
- Ground every number you state in a tool result from this conversation. If the tools don't cover something, say so plainly instead of estimating.
- Always be clear about provenance: Inspiration4 lab baselines and the research statistics are REAL NASA OSDR data; daily in-flight vitals and crew scenarios are SIMULATED on those baselines; dose, bone and muscle figures are MODEL estimates from published rates; space weather is LIVE from NASA DONKI when reachable.
- Crew names are fictional; never present them as real people.
- For anything at action or critical level, state who should respond (self-care, crew medical officer, or flight surgeon) and account for the comms delay at the current location. You support decisions; you do not replace the crew medical officer or flight surgeon. VITA is not a medical device.
- For research questions, report effect sizes with p and q values and the crew concordance, and mention that n = 4 limits statistical power.
- Be concise and scannable: lead with the answer, then short bullets. Use **bold** for key numbers. No tables wider than 4 columns. Do not use headings above level 3.`;

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(40),
  context: ContextSchema,
});

type Event =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; label: string; input: unknown }
  | { type: "tool_done"; id: string; ok: boolean }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
          send({ type: "error", code: "not_configured", message: "The copilot needs an ANTHROPIC_API_KEY on the server (.env.local locally, or a Vercel environment variable)." });
          return;
        }
        await runConversation(body, send);
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) send({ type: "error", code: "auth", message: "The Anthropic API key was rejected." });
        else if (err instanceof Anthropic.RateLimitError) send({ type: "error", code: "rate_limit", message: "Rate limited by the Claude API. Try again in a moment." });
        else if (err instanceof Anthropic.APIError) send({ type: "error", code: "api", message: `Claude API error ${err.status ?? ""}: ${err.message}` });
        else send({ type: "error", code: "internal", message: err instanceof Error ? err.message : "Unexpected error" });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

async function runConversation(body: z.infer<typeof BodySchema>, send: (e: Event) => void) {
  const client = new Anthropic();
  const ctx = body.context;
  const env = ENV_MAP[ctx.env];

  // Per-request context goes into the latest user turn, after the cached system prompt and tools.
  const contextNote = `<dashboard_context>
Location: ${env.name} (one-way comms delay ${env.commsDelaySec[0]}–${env.commsDelaySec[1]} s, gravity ${env.gravityG} g)
Mission day: ${MISSION.currentDay} of ${MISSION.length}
Page the user is viewing: ${ctx.page ?? "/"}${ctx.focusCrewId ? `\nCrew member in focus: ${ctx.focusCrewId}` : ""}
Astronaut-logged entries today: ${Object.entries(ctx.entries ?? {}).map(([k, v]) => `${k}: ${v.length}`).join(", ") || "none"}
Active solar-storm drills: ${(ctx.sepEvents ?? []).length}
</dashboard_context>`;

  const messages: Anthropic.Beta.BetaMessageParam[] = body.messages.map((m, i) =>
    i === body.messages.length - 1 && m.role === "user"
      ? { role: "user", content: [{ type: "text", text: contextNote }, { type: "text", text: m.content }] }
      : { role: m.role, content: m.content },
  );

  const tools: Anthropic.Beta.BetaTool[] = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true,
  }));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      tools,
      messages,
    });
    stream.on("text", (delta) => send({ type: "text", delta }));
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      send({ type: "text", delta: "\n\nI can't help with that request." });
      return;
    }
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) return;
    if (round === MAX_TOOL_ROUNDS) {
      send({ type: "text", delta: "\n\n(Stopped after the maximum number of data lookups.)" });
      return;
    }

    messages.push({ role: "assistant", content: message.content });
    const results = await Promise.all(
      toolUses.map(async (tu): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        send({ type: "tool", id: tu.id, name: tu.name, label: TOOL_LABELS[tu.name as ToolName] ?? tu.name, input: tu.input });
        try {
          // runTool validates the (eagerly streamed) input against the tool's Zod schema before running.
          const out = await runTool(tu.name, tu.input, ctx, { spaceWeather: fetchSpaceWeather });
          send({ type: "tool_done", id: tu.id, ok: true });
          return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) };
        } catch (e) {
          send({ type: "tool_done", id: tu.id, ok: false });
          return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: e instanceof Error ? e.message : "Tool failed" };
        }
      }),
    );
    // All tool results go back in a single user message.
    messages.push({ role: "user", content: results });
  }
}
