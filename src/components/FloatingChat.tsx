import { Maximize2, Minus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SignInForAi } from "@/pages/Assistant";
import { useApp } from "@/state/AppState";
import { ChatPanel, useChatHistory } from "./ChatPanel";
import { cn } from "./ui";

/** Small "Ask AI" bubble on every page; opens a compact chat. */
export function FloatingChat() {
  const app = useApp();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const live = app.mode === "live";
  const [messages, setMessages] = useChatHistory(live && open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.startsWith("/assistant") || pathname.startsWith("/onboarding")) return null;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AI Companion"
          className="fixed inset-x-3 bottom-[76px] top-16 z-40 flex flex-col overflow-hidden rounded-4xl border border-line bg-lavender-soft shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:h-[min(620px,calc(100vh-48px))] md:w-[400px]"
        >
          <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold leading-tight">AI Companion</p>
              <p className="truncate text-xs text-muted">
                {app.city.flag} {app.city.name} · knows your plan & calendar
              </p>
            </div>
            <Link to="/assistant" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Open full screen">
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Minimize chat">
              <Minus className="h-5 w-5" />
            </button>
          </div>
          {live ? <ChatPanel compact messages={messages} setMessages={setMessages} /> : <SignInForAi compact />}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI chat" : "Ask AI"}
        className={cn(
          "fixed bottom-[84px] right-4 z-40 flex items-center gap-2 rounded-full bg-primary py-3 pl-4 pr-5 text-white shadow-xl transition hover:bg-primary-dark md:bottom-6 md:right-6",
          open && "hidden",
        )}
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">Ask AI</span>
      </button>
    </>
  );
}
