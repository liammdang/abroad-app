import { ArrowLeft, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/components/ui";
import { askAi, buildContext, clearHistory, loadHistory, type ChatMessage } from "@/lib/ai";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

const SUGGESTIONS: Record<string, string[]> = {
  berlin: ["How do I book an Anmeldung appointment?", "Which bank account works without a Schufa?", "Is the Semesterticket valid outside Berlin?"],
  madrid: ["How do I get my TIE appointment?", "What do I need for empadronamiento?", "Best way to get a Spanish SIM card?"],
  lisbon: ["How do I get a NIF as a student?", "What do I need for the AIMA residence permit?", "How does the Navegante pass work?"],
};

export default function Assistant() {
  const app = useApp();
  const { city } = app;
  const live = app.mode === "live";
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  const context = useMemo(
    () => buildContext({ today: app.today, city, profile: app.profile, isDone: app.isDone, events: app.events }),
    [app.today, city, app.profile, app.isDone, app.events],
  );

  useEffect(() => {
    if (!live) return;
    loadHistory()
      .then(setMessages)
      .catch((e) => {
        toast(`Could not load chat: ${(e as Error).message}`);
        setMessages([]);
      });
  }, [live]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setDraft("");
    setSending(true);
    setMessages((m) => [...(m ?? []), { id: `local-${Date.now()}`, role: "user", content: q }]);
    try {
      const reply = await askAi(q, context);
      setMessages((m) => [...(m ?? []), { id: `local-${Date.now()}-a`, role: "assistant", content: reply }]);
    } catch (e) {
      toast((e as Error).message);
      setMessages((m) => (m ?? []).slice(0, -1));
      setDraft(q);
    } finally {
      setSending(false);
    }
  };

  // question typed on the Home card
  useEffect(() => {
    const q = params.get("q");
    if (live && messages !== null && q && !sentInitial.current) {
      sentInitial.current = true;
      setParams({}, { replace: true });
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, messages]);

  const clear = async () => {
    if (!window.confirm("Delete your whole chat history?")) return;
    try {
      await clearHistory();
      setMessages([]);
      toast("Chat cleared");
    } catch (e) {
      toast((e as Error).message);
    }
  };

  if (!live) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="card bg-lavender-soft p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-bold">AI Companion</h1>
          <p className="mt-2 font-light text-muted">
            {app.backendReady ? "Sign in with Google to chat with your AI Companion." : "Connect the backend (see SETUP.md) to turn on the AI Companion."}
          </p>
          {app.backendReady && (
            <button className="btn-primary mt-6" onClick={() => void app.signIn()}>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    );
  }

  const empty = messages !== null && messages.length === 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">AI Companion</p>
          <h1 className="page-title">Ask anything about {city.name}</h1>
        </div>
        {!empty && messages !== null && (
          <button className="btn-outline shrink-0 py-2 text-sm" onClick={() => void clear()}>
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      <div className="card flex min-h-[60vh] flex-1 flex-col overflow-hidden bg-lavender-soft">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages === null && <p className="py-10 text-center text-muted">Loading…</p>}
          {empty && (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-3 font-light text-muted">I know your city, your checklist and your calendar. Try one of these:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(SUGGESTIONS[city.id] ?? []).map((s) => (
                  <button key={s} className="pill bg-white" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages?.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" && "justify-end")}>
              {m.role === "user" ? (
                <p className="max-w-[88%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-white">{m.content}</p>
              ) : (
                <div className="max-w-[88%] space-y-2 rounded-3xl rounded-bl-lg bg-white px-5 py-3.5 text-ink">
                  <Markdown text={m.content} />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex">
              <p className="rounded-3xl rounded-bl-lg bg-white px-4 py-2.5 text-muted">
                <span className="animate-pulse">Thinking…</span>
              </p>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-line bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            className="input min-h-[48px] flex-1 resize-none py-3"
            rows={1}
            placeholder={`Ask about life in ${city.name}…`}
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <button type="submit" className="btn-primary h-12 w-12 shrink-0 p-0" disabled={!draft.trim() || sending} aria-label="Send">
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
      <p className="mt-3 text-center text-[13px] font-light text-muted">AI answers can be wrong. Check official rules with the office or your university.</p>
    </div>
  );
}

/* ───────────── tiny, safe Markdown renderer for AI answers ─────────────
   Handles headings, **bold**, *italic*, `code`, [links](url), bare URLs,
   bullet / numbered lists and --- rules. Builds React elements (no raw HTML). */

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<]+[^\s)<.,;:!?])|`([^`]+)`|\*([^*\s][^*]*)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${m.index}`;
    if (m[2] || m[3]) out.push(<strong key={k} className="font-semibold">{inline(m[2] ?? m[3], key + 1)}</strong>);
    else if (m[4]) out.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{m[4]}</a>);
    else if (m[6]) out.push(<a key={k} href={m[6]} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-2">{m[6]}</a>);
    else if (m[7]) out.push(<code key={k} className="rounded bg-sand px-1.5 py-0.5 text-[0.9em]">{m[7]}</code>);
    else if (m[8]) out.push(<em key={k}>{m[8]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="leading-relaxed">
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, i)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={`l${blocks.length}`} className={cn("space-y-1 pl-5 leading-relaxed", list.ordered ? "list-decimal" : "list-disc")}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it, i)}</li>
          ))}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      flushList();
      blocks.push(<hr key={`h${blocks.length}`} className="my-1 border-line" />);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={`t${blocks.length}`} className="pt-1 font-display text-[17px] font-bold">
          {inline(heading[1].replace(/\*\*/g, ""))}
        </p>,
      );
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !bullet;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}
