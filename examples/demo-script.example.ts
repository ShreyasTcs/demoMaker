/**
 * EXAMPLE — scripted demo mode for AI / streaming / async UI
 *
 * Drop this pattern into apps whose UI depends on a live backend
 * (Claude / OpenAI / WebSockets / SSE / etc.) — the real backend
 * produces variable output and the demo will drift between runs.
 *
 * The fix: when an env flag like NEXT_PUBLIC_DEMO_MODE=1 is set, your
 * client-side networking layer should bypass the real API and replay
 * a hardcoded fixture. That gives you identical visuals every render.
 *
 * For a static / deterministic app, skip this entirely.
 *
 * The example below targets a chat UI that streams text + tool calls
 * via Server-Sent Events. Adapt the event shapes to your protocol.
 */

/* ── 1. The script: one entry per user message ─────────────────── */

export interface DemoSegment {
  text?: string;                            // streamed gradually
  tool?: {                                  // OR a tool-call badge
    name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    runMs: number;                          // how long the badge shows "running"
  };
  pauseMs?: number;
}

export interface DemoTurn {
  segments: DemoSegment[];
}

export const DEMO_SCRIPT: DemoTurn[] = [
  // Turn 0 — first reply (e.g. greeting after the chat is opened)
  {
    segments: [
      {
        text: "Hi! What would you like to do?\n\n[CHOICES: Option A | Option B | Option C]",
        pauseMs: 200,
      },
    ],
  },

  // Turn 1 — fires after the user clicks/types whatever
  {
    segments: [
      { text: "Got it — let me look that up for you.\n", pauseMs: 200 },
      {
        tool: {
          name: "lookup_thing",
          input: { id: "abc-123" },
          output: { result: "found", details: { /* whatever */ } },
          runMs: 900,
        },
        pauseMs: 200,
      },
      { text: "Here's what I found. Want to proceed?\n\n[CHOICES: Yes | No]", pauseMs: 150 },
    ],
  },

  // Turn 2, 3, … — keep going as needed
];

/* ── 2. The networking-layer branch ────────────────────────────── */

// In your client, where you'd normally call /api/chat or open an SSE
// stream, check the env flag first. If set, advance the script.

declare function appendAssistantText(id: string, delta: string): void;
declare function addToolCall(id: string, call: object): void;
declare function completeToolCall(id: string, toolId: string, output: unknown): void;
declare function finalizeAssistant(id: string): void;
declare function setSending(b: boolean): void;
declare function getUserMessageCount(): number;

const DEMO_MODE =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEMO_MODE === "1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function streamText(assistantId: string, text: string) {
  const chunkSize = 4;
  for (let i = 0; i < text.length; i += chunkSize) {
    appendAssistantText(assistantId, text.slice(i, i + chunkSize));
    await sleep(6 + Math.random() * 8);   // ~3 ms/char — feels natural
  }
}

export async function playScriptedTurn(assistantId: string) {
  // Turn index = number of user messages so far minus one
  const turnIdx = getUserMessageCount() - 1;
  const turn = DEMO_SCRIPT[turnIdx];

  if (!turn) {
    appendAssistantText(assistantId, "_Demo script complete — reset to replay._");
    finalizeAssistant(assistantId);
    setSending(false);
    return;
  }

  for (const seg of turn.segments) {
    if (seg.text) {
      await streamText(assistantId, seg.text);
    } else if (seg.tool) {
      const toolId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      addToolCall(assistantId, {
        id: toolId,
        name: seg.tool.name,
        input: seg.tool.input,
        status: "running",
      });
      await sleep(seg.tool.runMs);
      completeToolCall(assistantId, toolId, seg.tool.output);
    }
    if (seg.pauseMs) await sleep(seg.pauseMs);
  }

  finalizeAssistant(assistantId);
  setSending(false);
}

/* ── 3. Wire it up ─────────────────────────────────────────────── */

export async function sendMessage(userText: string) {
  /* existing code that adds the user message to the store … */

  if (DEMO_MODE) {
    const assistantId = /* create empty assistant message */ "TODO";
    setSending(true);
    await playScriptedTurn(assistantId);
    return;
  }

  /* existing fetch / SSE / WebSocket code path … */
}

/* ── TIPS ──────────────────────────────────────────────────────────
 *
 * 1.  The hardcoded fixture preserves the streaming UI animation
 *     (text appearing character-by-character, tool badges popping in
 *     and out). That's the visually compelling part of the demo —
 *     don't bypass it with synchronous text dumps.
 *
 * 2.  Match the event shapes your real backend emits. If your real
 *     code expects SSE events like {type:"text_delta", text:"..."},
 *     emit those same events from the mock. The UI layer should not
 *     have to know whether it's seeing real or mock data.
 *
 * 3.  Choices/buttons embedded in the streamed text (e.g. via a
 *     [CHOICES: A | B] marker convention) become tappable buttons in
 *     the UI. ndemo's playbook just clicks them by their `name`.
 *
 * 4.  Keep the turn count modest (5–10). More turns mean more time
 *     pressure to fit each one inside the audio window.
 *
 * ────────────────────────────────────────────────────────────────── */
