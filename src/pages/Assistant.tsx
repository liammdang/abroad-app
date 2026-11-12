import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ChatPanel, useChatHistory } from "@/components/ChatPanel";
import { clearHistory } from "@/lib/ai";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

export default function Assistant() {
  const app = useApp();
  const { city } = app;
  const live = app.mode === "live";
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useChatHistory(live);

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

  if (!live) return <SignInForAi />;

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

      <div className="card flex h-[68vh] min-h-[420px] flex-col overflow-hidden bg-lavender-soft">
        <ChatPanel
          messages={messages}
          setMessages={setMessages}
          initialQuestion={params.get("q")}
          onInitialSent={() => setParams({}, { replace: true })}
        />
      </div>
      <p className="mt-3 text-center text-[13px] font-light text-muted">AI answers can be wrong. Check official rules with the office or your university.</p>
    </div>
  );
}

export function SignInForAi({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  return (
    <div className={compact ? "p-6 text-center" : "mx-auto max-w-2xl"}>
      {!compact && (
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      )}
      <div className={compact ? "" : "card bg-lavender-soft p-8 text-center"}>
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h1 className={compact ? "mt-3 text-xl font-bold" : "mt-4 text-3xl font-bold"}>AI Companion</h1>
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
