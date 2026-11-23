// OpenUI's chat client speaking Eve's session protocol, through the app's admin-only proxy at /api/eve.
// The conversation stays in this tab's memory: nothing is written to browser storage or a third-party service.
// OpenUI ships an adapter for an older Eve stream, so this one reads the current format (stream version 27).
import { EventType, type AGUIEvent, type ChatLLM, type Message } from "@openuidev/react-headless";

const PREFIX = "/api/eve/v1";
const SESSION_HEADER = "x-eve-session-id";

type Cursor = { sessionId?: string; line: number };
type Fact = { type?: string; data?: Record<string, unknown> };
type StreamLine = { facts?: Fact[]; progress?: Fact; $eve?: string };

const textOf = (message: Pick<Message, "content">): string => {
  const content = message.content as unknown;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : "")).join("\n");
};

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return new Error(typeof body?.error === "string" ? body.error : fallback);
}

async function* lines(response: Response): AsyncGenerator<StreamLine> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += value ?? "";
      const parts = buffer.split("\n");
      buffer = done ? "" : parts.pop() ?? "";
      for (const part of parts) {
        if (!part.trim()) continue;
        try { yield JSON.parse(part) as StreamLine; } catch { /* a line that isn't JSON carries nothing to show */ }
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

const errorOf = (fact: Fact): string | null => {
  const error = fact.data?.error as { message?: unknown } | undefined;
  return error ? (typeof error.message === "string" ? error.message : "Eve hit a problem.") : null;
};

export function createEveLLM(): ChatLLM {
  const cursors = new Map<string, Cursor>();
  let active: { threadId: string; cursor: Cursor; signal: AbortSignal } | null = null;

  return {
    async send({ messages, threadId, signal }) {
      const cursor = cursors.get(threadId) ?? { line: 0 };
      const latest = [...messages].reverse().find((m) => m.role === "user");
      const path = cursor.sessionId ? `${PREFIX}/session/${encodeURIComponent(cursor.sessionId)}` : `${PREFIX}/session`;
      const delivered = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: latest ? textOf(latest).trim() : "" }),
        signal,
      });
      if (!delivered.ok) throw await failure(delivered, "Eve couldn’t take that message.");
      const meta = await delivered.json().catch(() => ({})) as { sessionId?: string };
      const sessionId = meta.sessionId ?? delivered.headers.get(SESSION_HEADER)?.trim() ?? cursor.sessionId;
      if (!sessionId) throw new Error("Eve didn’t start a conversation.");
      const line = cursor.sessionId === sessionId ? cursor.line : 0;
      active = { threadId, cursor: { sessionId, line }, signal };
      const stream = await fetch(`${PREFIX}/session/${encodeURIComponent(sessionId)}/stream?startIndex=${line}`, { signal });
      if (!stream.ok || !stream.body) throw await failure(stream, "Eve’s answer was interrupted.");
      return stream;
    },
    streamProtocol: {
      async *parse(response): AsyncGenerator<AGUIEvent> {
        const run = active;
        if (!run) return;
        const messageId = crypto.randomUUID();
        let started = false;
        let current: Response | null = response;
        const save = () => cursors.set(run.threadId, run.cursor);

        try {
          while (current) {
            const reading: Response = current;
            current = null;
            for await (const record of lines(reading)) {
              if (record.$eve === "stream.ended") {
                run.cursor = { line: 0 };
                return;
              }
              if (record.$eve === "stream.lease-ended") {
                const next = await fetch(`${PREFIX}/session/${encodeURIComponent(run.cursor.sessionId ?? "")}/stream?startIndex=${run.cursor.line}`, { signal: run.signal });
                if (!next.ok || !next.body) throw await failure(next, "Eve’s answer was interrupted.");
                current = next;
                break;
              }
              if (record.$eve) continue;
              run.cursor = { ...run.cursor, line: run.cursor.line + 1 };
              let finished = false;
              for (const fact of record.facts ?? []) {
                if (fact.type === "content.completed" && fact.data?.kind === "text" && fact.data.phase !== "narration" && typeof fact.data.value === "string") {
                  if (!started) {
                    started = true;
                    yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" } as AGUIEvent;
                  }
                  yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: fact.data.value } as AGUIEvent;
                } else if (fact.type === "turn.settled" || fact.type === "turn.paused") {
                  finished = true;
                  const message = errorOf(fact);
                  if (message) yield { type: EventType.RUN_ERROR, message } as AGUIEvent;
                } else if (fact.type === "session.ended") {
                  finished = true;
                  run.cursor = { line: 0 };
                  const message = errorOf(fact);
                  if (message) yield { type: EventType.RUN_ERROR, message } as AGUIEvent;
                }
              }
              if (finished) return;
            }
          }
        } finally {
          save();
          if (started) yield { type: EventType.TEXT_MESSAGE_END, messageId } as AGUIEvent;
        }
      },
    },
  };
}
