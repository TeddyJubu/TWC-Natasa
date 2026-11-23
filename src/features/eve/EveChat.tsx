// Eve's chat panel: OpenUI's headless chat, answers rendered with the shadcn component library, and the confirm cards.
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatProvider, useThread, type Message } from "@openuidev/react-headless";
import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { ArrowUp, Square, X } from "lucide-react";
import { shadcnChatLibrary } from "./genui";
import { SafeMarkdown } from "./genui/components/markdown-renderer";
import { isSitePath } from "./genui/safe";
import { Button } from "./genui/ui/button";
import { Textarea } from "./genui/ui/textarea";
import { createEveLLM } from "./eve-llm";
import "./eve.css";

type Proposal = {
  id: string; label: string; area: string; notifies: boolean; destructive: boolean;
  subject: string | null; fields: { key: string; value: string }[]; expiresAt: string;
};
type Decision = { ok: boolean; label: string; error?: string; result?: { url?: unknown; expires_at?: unknown } };

const STARTERS = ["What’s waiting on me today?", "Find a member by name", "Show upcoming events", "Which forms are open?"];
const POLL_MS = 2500;

const textOf = (message: Message): string => {
  const content = message.content as unknown;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : "")).join("\n");
};

/** OpenUI Lang starts with a `root =` statement; everything else Eve writes is plain markdown. */
const isOpenUi = (text: string) => /^\s*root\s*=/m.test(text);

function Answer({ text, streaming, onSend }: { text: string; streaming: boolean; onSend: (message: string) => void }) {
  const onAction = (event: ActionEvent) => {
    if (event.type === BuiltinActionType.OpenUrl) {
      if (isSitePath(event.params.url)) window.location.assign(event.params.url);
      return;
    }
    if (event.type === BuiltinActionType.ContinueConversation && event.humanFriendlyMessage) onSend(event.humanFriendlyMessage);
  };
  if (isOpenUi(text)) return <Renderer response={text} library={shadcnChatLibrary} isStreaming={streaming} onAction={onAction} />;
  return <div className="eve-prose"><SafeMarkdown text={text} /></div>;
}

function ProposalCard({ proposal, busy, onDecide }: { proposal: Proposal; busy: boolean; onDecide: (decision: "confirm" | "cancel") => void }) {
  return (
    <section aria-label={`Confirm: ${proposal.label}`} className="eve-card">
      <h3 className="text-sm font-semibold">{proposal.label}</h3>
      {proposal.subject && <p className="text-sm">For {proposal.subject}</p>}
      {proposal.fields.length > 0 && (
        <dl className="eve-fields">
          {proposal.fields.map((field) => (
            <div key={field.key}><dt>{field.key}</dt><dd>{field.value}</dd></div>
          ))}
        </dl>
      )}
      {proposal.notifies && <p className="eve-warn">This may email or notify people.</p>}
      {proposal.destructive && <p className="eve-warn">This can’t be undone from here.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide("cancel")}>Cancel</Button>
        <Button variant={proposal.destructive ? "destructive" : "default"} size="sm" disabled={busy} onClick={() => onDecide("confirm")}>Confirm</Button>
      </div>
    </section>
  );
}

function useProposals() {
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const refresh = React.useCallback(async () => {
    const response = await fetch("/api/eve-proposals").catch(() => null);
    if (!response?.ok) return;
    const body = await response.json().catch(() => null) as { proposals?: Proposal[] } | null;
    if (body?.proposals) setProposals(body.proposals);
  }, []);
  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { proposals, refresh };
}

function Conversation({ onClose }: { onClose: () => void }) {
  const messages = useThread((s) => s.messages);
  const isRunning = useThread((s) => s.isRunning);
  const threadError = useThread((s) => s.threadError);
  const processMessage = useThread((s) => s.processMessage);
  const cancelMessage = useThread((s) => s.cancelMessage);
  const queryClient = useQueryClient();
  const { proposals, refresh } = useProposals();
  const [draft, setDraft] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; url?: string; error?: boolean } | null>(null);
  const log = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { input.current?.focus(); }, []);
  React.useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, proposals, isRunning]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || isRunning) return;
    setNotice(null);
    setDraft("");
    void processMessage({ role: "user", content: message });
  };

  const decide = async (proposal: Proposal, decision: "confirm" | "cancel") => {
    setBusyId(proposal.id);
    setNotice(null);
    const response = await fetch("/api/eve-proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: proposal.id, decision }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null) as (Decision & { error?: string }) | null | undefined;
    setBusyId(null);
    await refresh();
    if (!response?.ok || !body) {
      setNotice({ text: body?.error ?? "That didn’t go through. Nothing was changed.", error: true });
      return;
    }
    if (decision === "cancel") {
      setNotice({ text: `Cancelled: ${proposal.label}.` });
      if (!isRunning) void processMessage({ role: "user", content: `I cancelled “${proposal.label}”. Don't retry it unless I ask.` });
      return;
    }
    await queryClient.invalidateQueries();
    const url = typeof body.result?.url === "string" ? body.result.url : undefined;
    setNotice(body.ok
      ? { text: url ? `Done: ${proposal.label}. This link is shown only once.` : `Done: ${proposal.label}.`, url }
      : { text: body.error ?? "That didn’t work.", error: true });
    const outcome = body.ok ? "It succeeded." : `It failed: ${body.error ?? "unknown error"}.`;
    if (!isRunning) void processMessage({ role: "user", content: `I confirmed “${proposal.label}”. ${outcome}` });
  };

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const last = visible[visible.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="eve-head">
        <div className="min-w-0">
          <h2 className="eve-title">Eve</h2>
          <p className="text-xs text-muted-foreground">Nothing changes until you confirm it.</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close Eve" onClick={onClose}><X /></Button>
      </header>

      <div ref={log} role="log" aria-label="Conversation with Eve" aria-live="polite" tabIndex={0} className="eve-log">
        {visible.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Hi, I’m Eve. Ask me anything about the club, or tell me what to change.</p>
            <div className="flex flex-col items-start gap-2">
              {STARTERS.map((starter) => (
                <Button key={starter} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left" onClick={() => send(starter)}>{starter}</Button>
              ))}
            </div>
          </div>
        )}
        {visible.map((message) => {
          const text = textOf(message);
          if (message.role === "user") return <p key={message.id} className="eve-user">{text}</p>;
          if (!text.trim()) return null;
          return <div key={message.id} className="eve-answer"><Answer text={text} streaming={isRunning && message === last} onSend={send} /></div>;
        })}
        {isRunning && <p role="status" className="text-sm text-muted-foreground">Eve is working…</p>}
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} busy={busyId === proposal.id} onDecide={(decision) => void decide(proposal, decision)} />
        ))}
        {notice && (
          <div role={notice.error ? "alert" : "status"} className={notice.error ? "eve-warn" : "eve-notice"}>
            <p>{notice.text}</p>
            {notice.url && <input readOnly aria-label="One-time link" value={notice.url} onFocus={(e) => e.currentTarget.select()} className="eve-link" />}
          </div>
        )}
        {threadError && <p role="alert" className="eve-warn">{threadError.message}</p>}
      </div>

      <form className="eve-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <Textarea
          ref={input}
          aria-label="Message Eve"
          placeholder="Ask Eve…"
          rows={1}
          maxLength={8000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(draft);
            }
          }}
          className="max-h-32 min-h-10 resize-none text-sm"
        />
        {isRunning
          ? <Button type="button" size="icon" variant="outline" aria-label="Stop Eve" onClick={() => cancelMessage()}><Square /></Button>
          : <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim()}><ArrowUp /></Button>}
      </form>
    </div>
  );
}

export default function EveChat({ onClose }: { onClose: () => void }) {
  const llm = React.useMemo(() => createEveLLM(), []);
  return (
    <div className="eve-root h-full">
      <ChatProvider llm={llm}>
        <Conversation onClose={onClose} />
      </ChatProvider>
    </div>
  );
}
