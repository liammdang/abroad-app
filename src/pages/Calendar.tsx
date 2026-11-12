import { CalendarPlus, ChevronLeft, ChevronRight, Link2, Plus, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal, PageHeader, cn } from "@/components/ui";
import { EVENT_CATEGORIES, categoryColor, categoryLabel } from "@/data/cities";
import type { CalEvent, EventCategory } from "@/data/types";
import { monthLong, panelDate, parseISO, stampDate, toISO } from "@/lib/date";
import { parseICS } from "@/lib/ics";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

type Filter = "all" | "classes" | "deadlines" | "social";
const FILTERS: { id: Filter; label: string; cats: EventCategory[] }[] = [
  { id: "all", label: "All", cats: ["class", "exam", "assignment", "admin", "travel", "social"] },
  { id: "classes", label: "Classes", cats: ["class"] },
  { id: "deadlines", label: "Deadlines", cats: ["exam", "assignment", "admin"] },
  { id: "social", label: "Travel & Social", cats: ["travel", "social"] },
];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** does the event happen on this ISO day (multi-day trips included) */
const onDay = (e: CalEvent, iso: string) => e.date === iso || (!!e.endDate && e.date <= iso && iso <= e.endDate);

const SOURCE_LABEL: Record<string, string> = {
  google: "Google Calendar",
  ical: "Timetable feed",
  manual: "Added by you",
  plan: "From your AI plan",
};

function EventRow({ e, onDelete }: { e: CalEvent; onDelete?: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", categoryColor(e.category))} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] leading-snug text-ink">{e.title}</p>
        <p className="text-sm font-light text-muted">
          {[e.time, e.place, SOURCE_LABEL[e.source ?? ""]].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-sand px-2.5 py-0.5 text-[13px] text-muted">{categoryLabel(e.category)}</span>
      {onDelete && (
        <button aria-label="Delete event" className="mt-0.5 shrink-0 text-muted hover:text-cat-exam" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const app = useApp();
  const today = app.today;
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const d = parseISO(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"month" | "list">("month");
  const [icalOpen, setIcalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const googleOn = app.mode === "live" && app.integrations.googleCalendar && app.googleConnected.calendar;
  const planCount = app.events.filter((e) => e.source === "plan").length;

  // after adding an event, copy it to Google once the new list has loaded
  useEffect(() => {
    if (!autoSync) return;
    setAutoSync(false);
    void app.syncGoogle().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.events]);

  const cats = FILTERS.find((f) => f.id === filter)!.cats;
  const events = useMemo(() => app.events.filter((e) => cats.includes(e.category)), [app.events, cats]);

  // build Monday-first grid for the cursor month
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(cursor.y, cursor.m, 1 - offset);
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === cursor.m };
    });
  }, [cursor]);

  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => e.date.startsWith(monthPrefix) || (e.endDate ?? "").startsWith(monthPrefix));
  const dayEvents = events.filter((e) => onDay(e, selected));

  const shift = (n: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const syncGoogle = async () => {
    setSyncing(true);
    try {
      await app.syncGoogle();
    } catch (e) {
      toast(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Semester planner"
        title="Calendar"
        right={
          <div className="flex flex-wrap gap-3">
            <button className="btn-outline" onClick={() => void syncGoogle()} disabled={syncing}>
              <RefreshCw className={cn("h-[18px] w-[18px]", syncing && "animate-spin")} /> {syncing ? "Syncing…" : "Sync Google"}
            </button>
            <button className="btn-outline" onClick={() => setIcalOpen(true)}>
              <CalendarPlus className="h-[18px] w-[18px]" /> iCal feed
            </button>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-[18px] w-[18px]" /> Add event
            </button>
          </div>
        }
      />

      {planCount > 0 && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl bg-lavender-soft px-4 py-3 text-[15px] text-ink">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Your AI plan added <b>{planCount} key dates</b> (deadlines, appointments, orientation).
            {googleOn ? " Tap Sync Google to copy them to your Google Calendar." : " Connect Google Calendar in Settings to get them on your phone."}
          </span>
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} className={cn("pill", filter === f.id && "pill-active")} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-line bg-white p-1">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("rounded-full px-5 py-1.5 text-[15px] capitalize", view === v ? "bg-lavender text-primary" : "text-muted")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold md:text-2xl">
              {monthLong(cursor.m)} {cursor.y}
            </h2>
            <div className="flex gap-1">
              <button aria-label="Previous month" onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button aria-label="Next month" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {view === "month" ? (
            <>
              <div className="grid grid-cols-7 text-center text-sm text-muted">
                {WEEK.map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((c) => {
                  const dots = Array.from(new Set(events.filter((e) => onDay(e, c.iso)).map((e) => e.category))).slice(0, 3);
                  const isSel = c.iso === selected;
                  const isToday = c.iso === today;
                  return (
                    <button
                      key={c.iso}
                      onClick={() => setSelected(c.iso)}
                      className={cn(
                        "flex h-16 flex-col items-center rounded-2xl pt-2 transition md:h-[80px] md:rounded-3xl",
                        isSel ? "bg-primary text-white" : isToday ? "bg-lavender" : "hover:bg-sand",
                        !c.inMonth && !isSel && "text-muted/50",
                      )}
                    >
                      <span className="text-[16px]">{c.day}</span>
                      <span className="mt-1 flex gap-0.5">
                        {dots.map((cat) => (
                          <span key={cat} className={cn("h-1.5 w-1.5 rounded-full", categoryColor(cat), isSel && "ring-1 ring-white")} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {EVENT_CATEGORIES.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", c.color)} /> {c.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="divide-y divide-line">
              {monthEvents.length === 0 && <Empty>No events this month.</Empty>}
              {monthEvents.map((e) => (
                <button key={e.id} onClick={() => setSelected(e.date)} className="block w-full py-4 text-left">
                  <p className="mb-1 text-[13px] font-medium tracking-wide text-primary">{stampDate(e.date)}</p>
                  <EventRow e={e} />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{panelDate(selected)}</h2>
            <button aria-label="Add event on this day" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-primary hover:bg-primary hover:text-white" onClick={() => setAddOpen(true)}>
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-5">
            {dayEvents.length === 0 && <p className="text-muted">Nothing planned for this day.</p>}
            {dayEvents.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                onDelete={
                  e.source === "manual"
                    ? () => {
                        if (window.confirm(`Delete "${e.title}"?`)) void app.deleteEvent(e.id);
                      }
                    : undefined
                }
              />
            ))}
          </div>
          {app.googleError && <p className="mt-8 text-xs text-cat-exam">Google Calendar: {app.googleError}</p>}
          {app.integrations.lastSync && app.integrations.googleCalendar && (
            <p className="mt-8 text-xs text-muted">Last synced with Google: {new Date(app.integrations.lastSync).toLocaleString()}</p>
          )}
        </aside>
      </div>

      <ICalModal open={icalOpen} onClose={() => setIcalOpen(false)} />
      <AddEventModal
        open={addOpen}
        date={selected}
        googleOn={googleOn}
        onClose={() => setAddOpen(false)}
        onAdded={(iso) => {
          setSelected(iso);
          const d = parseISO(iso);
          setCursor({ y: d.getFullYear(), m: d.getMonth() });
          if (googleOn) setAutoSync(true);
        }}
      />
    </div>
  );
}

function AddEventModal({
  open,
  date,
  googleOn,
  onClose,
  onAdded,
}: {
  open: boolean;
  date: string;
  googleOn: boolean;
  onClose: () => void;
  onAdded: (iso: string) => void;
}) {
  const app = useApp();
  const [form, setForm] = useState({ title: "", date, time: "", place: "", category: "class" as EventCategory });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ title: "", date, time: "", place: "", category: "class" });
  }, [open, date]);

  const submit = async () => {
    setBusy(true);
    try {
      await app.addEvent({ title: form.title.trim(), date: form.date, time: form.time || undefined, place: form.place.trim() || undefined, category: form.category });
      toast(googleOn ? "Event added — copying it to Google Calendar…" : "Event added");
      onAdded(form.date);
      onClose();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add an event">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title.trim() && form.date) void submit();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Title</span>
          <input className="input" autoFocus placeholder="e.g. Marketing lecture, Anmeldung appointment" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Date</span>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Time <span className="font-light text-muted">· optional</span></span>
            <input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Place <span className="font-light text-muted">· optional</span></span>
          <input className="input" placeholder="Room, address or link" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
        </label>
        <div>
          <span className="mb-2 block text-sm font-medium">Type</span>
          <div className="flex flex-wrap gap-2">
            {EVENT_CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={cn("pill", form.category === c.id && "pill-active")} onClick={() => setForm({ ...form, category: c.id })}>
                <span className={cn("h-2 w-2 rounded-full", c.color)} /> {c.label}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy || !form.title.trim() || !form.date}>
          <Plus className="h-[18px] w-[18px]" /> {busy ? "Adding…" : "Add to calendar"}
        </button>
        {googleOn && <p className="text-center text-xs text-muted">It is also copied to your “Abroad” calendar in Google.</p>}
      </form>
    </Modal>
  );
}

function ICalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    const parsed = parseICS(await file.text(), `upload-${file.name}`);
    if (parsed.length === 0) {
      toast("No events found in that file");
      return;
    }
    setBusy(true);
    try {
      await app.importEvents(parsed);
      toast(`Imported ${parsed.length} events`);
      onClose();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onLink = async () => {
    setBusy(true);
    try {
      const n = await app.addFeed(url.trim());
      toast(`Feed connected — ${n} events. It refreshes every time you open the app.`);
      setUrl("");
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import your timetable">
      <p className="text-muted">
        Most university portals (Moodle, Canvas, Campus systems) can export your timetable as an iCal / .ics file or link.
      </p>

      <div className="mt-5 space-y-3">
        <button className="btn-primary w-full py-3" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-[18px] w-[18px]" /> Upload .ics file
        </button>
        <input ref={fileRef} type="file" accept=".ics,text/calendar" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

        <div className="flex items-center gap-3 py-1 text-sm text-muted">
          <span className="h-px flex-1 bg-line" /> or subscribe by link <span className="h-px flex-1 bg-line" />
        </div>
        {app.mode === "live" ? (
          <>
            <input className="input" placeholder="https://portal.university.edu/calendar.ics" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-outline w-full py-3" disabled={busy || !/^(https?|webcal):\/\//i.test(url.trim())} onClick={() => void onLink()}>
              <Link2 className="h-[18px] w-[18px]" /> {busy ? "Checking feed…" : "Subscribe to feed"}
            </button>
          </>
        ) : (
          <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-muted">
            {app.backendReady ? (
              <>
                <button className="font-medium text-primary underline" onClick={() => void app.signIn()}>
                  Sign in with Google
                </button>{" "}
                to subscribe to a live timetable link.
              </>
            ) : (
              "Live timetable links need the backend — see SETUP.md."
            )}
          </p>
        )}
      </div>

      {app.feeds.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium">Subscribed feeds</p>
          {app.feeds.map((f) => (
            <div key={f} className="flex items-center gap-2 rounded-2xl bg-sand px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{f}</span>
              <button aria-label="Remove feed" className="text-muted hover:text-cat-exam" onClick={() => void app.removeFeed(f)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {app.importedCount > 0 && (
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-sm">
          <span>{app.importedCount} uploaded events</span>
          <button className="font-medium text-primary hover:underline" onClick={() => void app.clearImported()}>
            Remove all
          </button>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Prefer Google? Connect it in <Link to="/settings" className="text-primary underline" onClick={onClose}>Settings</Link>.
      </p>
    </Modal>
  );
}
