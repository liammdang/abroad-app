import { CalendarDays, Circle, ExternalLink, GraduationCap, Home as HomeIcon, Inbox, LogOut, Mail as MailIcon, Map, RefreshCw, Stamp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconBubble, PageHeader, Toggle, cn } from "@/components/ui";
import type { Mail, MailFolder } from "@/data/types";
import { gmailLink, gmailQuery, listMail } from "@/lib/google";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

type IntegrationKey = "googleCalendar" | "googleMaps" | "smartEmail";

const INTEGRATIONS: { key: IntegrationKey; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: "googleCalendar", title: "Google Calendar", desc: "Two-way sync for classes and deadlines", icon: <CalendarDays className="h-5 w-5" /> },
  { key: "googleMaps", title: "Google Maps", desc: "Directions to offices and saved spots", icon: <Map className="h-5 w-5" /> },
  { key: "smartEmail", title: "Smart Email", desc: "Auto-sort university, visa and housing mail", icon: <MailIcon className="h-5 w-5" /> },
];

const FOLDERS: { id: MailFolder | "all"; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Inbox className="h-[18px] w-[18px]" /> },
  { id: "university", label: "University", icon: <GraduationCap className="h-[18px] w-[18px]" /> },
  { id: "immigration", label: "Immigration/Visa", icon: <Stamp className="h-[18px] w-[18px]" /> },
  { id: "housing", label: "Housing & Bills", icon: <HomeIcon className="h-[18px] w-[18px]" /> },
];

const folderLabel = (f: MailFolder) => FOLDERS.find((x) => x.id === f)!.label;
const MAIL_FOLDERS: MailFolder[] = ["university", "immigration", "housing"];

export default function Settings() {
  const app = useApp();
  const { city, profile, integrations } = app;
  const [folder, setFolder] = useState<MailFolder | "all">("all");
  const [busyKey, setBusyKey] = useState<IntegrationKey | null>(null);

  const live = app.mode === "live";
  const emailOn = integrations.smartEmail && (!live || app.googleConnected.gmail);

  /* real inbox */
  const [mail, setMail] = useState<Mail[] | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const [loadingMail, setLoadingMail] = useState(false);
  const domain = city.universityDomains[profile.university];

  const loadMail = useCallback(async () => {
    if (!live || !emailOn) return;
    setLoadingMail(true);
    setMailError(null);
    try {
      const opts = { universityDomain: domain, ...city.mailRules };
      const groups = await Promise.all(MAIL_FOLDERS.map((f) => listMail(f, gmailQuery(f, opts))));
      // a message can match several rules — keep the first folder it landed in
      const seen = new Set<string>();
      const merged = groups
        .flat()
        .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
        .sort((a, b) => b.ts - a.ts);
      setMail(merged);
    } catch (e) {
      setMailError((e as Error).message);
    } finally {
      setLoadingMail(false);
    }
  }, [live, emailOn, domain, city.mailRules]);

  useEffect(() => {
    void loadMail();
  }, [loadMail]);

  const source: Mail[] = live ? mail ?? [] : city.inbox;
  const mails = source.filter((m) => folder === "all" || m.folder === folder);
  const count = (f: MailFolder | "all") => (f === "all" ? source.length : source.filter((m) => m.folder === f).length);

  const toggle = async (key: IntegrationKey, v: boolean) => {
    const google = key !== "googleMaps";
    const granted = key === "googleCalendar" ? app.googleConnected.calendar : app.googleConnected.gmail;
    const willRedirect = live && v && google && !granted; // goes to Google's consent screen
    const demoBlocked = !live && app.backendReady && v && google; // AppState asks to sign in
    setBusyKey(key);
    try {
      await app.setIntegration(key, v);
      if (!willRedirect && !demoBlocked) toast(`${INTEGRATIONS.find((i) => i.key === key)!.title} ${v ? "connected" : "disconnected"}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  const connectedState = (key: IntegrationKey) => {
    if (key === "googleMaps") return integrations.googleMaps;
    if (!live) return integrations[key];
    return integrations[key] && (key === "googleCalendar" ? app.googleConnected.calendar : app.googleConnected.gmail);
  };

  const rules = [
    domain ? `mail from @${domain}` : "university keywords",
    `keywords like ${[...city.mailRules.immigration.slice(0, 2), ...city.mailRules.housing.slice(0, 2)].map((k) => `“${k}”`).join(", ")}`,
  ].join(", ");

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Integrations" />

      <div className="grid gap-5 md:grid-cols-3">
        {INTEGRATIONS.map((i) => {
          const on = connectedState(i.key);
          return (
            <div key={i.key} className="card p-6">
              <div className="flex items-start justify-between">
                <IconBubble className="h-12 w-12">{i.icon}</IconBubble>
                <Toggle label={i.title} checked={on} onChange={(v) => busyKey === null && void toggle(i.key, v)} />
              </div>
              <h3 className="mt-5 text-xl font-bold">{i.title}</h3>
              <p className="mt-1 font-light text-muted">{i.desc}</p>
              <p className={cn("mt-3 inline-flex items-center gap-1.5 text-[15px]", on ? "text-success" : "text-muted")}>
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-success" /> : <Circle className="h-3 w-3" />}
                {busyKey === i.key ? "Connecting…" : on ? "Connected" : "Not connected"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{live ? "Smart inbox" : "Smart inbox preview"}</h2>
        {live && emailOn && (
          <button className="btn-outline py-2 text-sm" onClick={() => void loadMail()} disabled={loadingMail}>
            <RefreshCw className={cn("h-4 w-4", loadingMail && "animate-spin")} /> Refresh
          </button>
        )}
      </div>
      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-[256px_1fr]">
          <div className="border-b border-line p-4 md:border-b-0 md:border-r">
            <div className="flex gap-1 overflow-x-auto md:flex-col">
              {FOLDERS.map((f) => {
                const active = folder === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFolder(f.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-left text-[16px] transition",
                      active ? "bg-primary text-white" : "text-ink/80 hover:bg-sand",
                    )}
                  >
                    {f.icon}
                    <span className="flex-1">{f.label}</span>
                    <span className={cn("text-sm", active ? "text-white/80" : "text-muted")}>{count(f.id)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 hidden px-3 text-[13px] font-light leading-relaxed text-muted md:block">Sorted by {rules}.</p>
          </div>

          <div className={cn("divide-y divide-line transition", !emailOn && "pointer-events-none select-none opacity-60 blur-[3px]")} aria-hidden={!emailOn}>
            {live && emailOn && loadingMail && mail === null && <p className="px-5 py-8 text-center text-muted">Loading your mail…</p>}
            {live && emailOn && mailError && <p className="px-5 py-8 text-center text-cat-exam">Gmail: {mailError}</p>}
            {live && emailOn && !loadingMail && !mailError && mails.length === 0 && (
              <p className="px-5 py-8 text-center text-muted">No matching mail in the last 6 months.</p>
            )}
            {(live && !emailOn ? city.inbox : mails).map((m) => {
              const body = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[17px] font-semibold">{m.from}</p>
                    <span className="shrink-0 text-sm text-muted">{m.when}</span>
                  </div>
                  <p className="text-[15px] text-ink/85">{m.subject}</p>
                  <p className="line-clamp-2 text-[15px] font-light text-muted">{m.preview}</p>
                  <span className="chip mt-2 text-[12px]">{folderLabel(m.folder)}</span>
                </>
              );
              return m.threadId ? (
                <a key={m.id} href={gmailLink(m.threadId)} target="_blank" rel="noreferrer" className="group block px-5 py-4 hover:bg-canvas">
                  {body}
                  <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-primary opacity-0 group-hover:opacity-100">
                    Open in Gmail <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              ) : (
                <div key={m.id} className="px-5 py-4">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
        {!emailOn && (
          <div className="border-t border-line px-5 py-5 text-center text-muted">Turn on Smart Email above to activate your sorted inbox.</div>
        )}
        {emailOn && !live && (
          <div className="border-t border-line px-5 py-3 text-center text-sm text-muted">Sample messages — sign in with Google to see your real inbox.</div>
        )}
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-bold">Profile</h2>
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-medium">
            {profile.name} · {city.flag} {city.name}
          </p>
          <p className="mt-1 font-light text-muted">
            {profile.university} · {profile.start} → {profile.end}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interests.map((i) => (
              <span key={i} className="rounded-full bg-sand px-3 py-1 text-sm">
                {i}
              </span>
            ))}
          </div>
        </div>
        <Link to="/onboarding" className="btn-outline shrink-0 self-start text-primary sm:self-center">
          Edit setup
        </Link>
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-bold">Account</h2>
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        {live ? (
          <>
            <div>
              <p className="text-lg font-medium">Signed in with Google</p>
              <p className="font-light text-muted">{app.userEmail}</p>
            </div>
            <button className="btn-outline shrink-0" onClick={() => void app.signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        ) : app.backendReady ? (
          <>
            <div>
              <p className="text-lg font-medium">Demo mode</p>
              <p className="font-light text-muted">Sign in to save your progress and use your real calendar, inbox and community.</p>
            </div>
            <button className="btn-primary shrink-0" onClick={() => void app.signIn()}>
              Sign in with Google
            </button>
          </>
        ) : (
          <div>
            <p className="text-lg font-medium">Demo mode (no backend connected)</p>
            <p className="font-light text-muted">Connect Supabase and Google to enable accounts — see SETUP.md in the project.</p>
          </div>
        )}
      </div>

      {!live && (
        <div className="mt-8 text-center">
          <button
            className="text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => {
              if (window.confirm("Reset all demo data (checklists, RSVPs, trips, settings)?")) {
                app.resetDemo();
                toast("Demo data reset");
              }
            }}
          >
            Reset demo data
          </button>
        </div>
      )}
    </div>
  );
}
