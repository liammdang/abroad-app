import { CalendarDays, Check, Download, MapPin, Plane, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal, PageHeader, Rating, cn } from "@/components/ui";
import { SPOT_CATEGORIES, mapsUrl, spotCategoryLabel } from "@/data/cities";
import type { SpotCategory } from "@/data/types";
import { APP_CATEGORIES, appsFor, storeLink, type AppCategory } from "@/data/apps";
import { rangeLabel, shortDate } from "@/lib/date";
import { MEETUP_CATEGORIES, forYouFirst, meetupMatches, spotMatches } from "@/lib/personalize";
import { toast } from "@/lib/toast";
import { useApp, type MeetupView, type TripView } from "@/state/AppState";
import { ForYou } from "./Home";

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const t = params.get("tab");
  const tab = t === "community" || t === "apps" ? t : "spots";

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Explore & Community"
        right={
          <div className="flex self-start rounded-full border border-line bg-white p-1 sm:self-auto">
            {(
              [
                ["spots", "Local spots"],
                ["community", "Community"],
                ["apps", "Apps"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setParams(id === "spots" ? {} : { tab: id })}
                className={cn("rounded-full px-4 py-2 text-[16px] sm:px-5", tab === id ? "bg-primary text-white" : "text-muted")}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {tab === "spots" ? <LocalSpots /> : tab === "apps" ? <EssentialApps /> : <Community />}
    </div>
  );
}

function LocalSpots() {
  const { city, integrations, profile } = useApp();
  const [cat, setCat] = useState<SpotCategory | "all">("all");
  const spots = forYouFirst(
    city.spots.filter((s) => cat === "all" || s.category === cat),
    (s) => spotMatches(s.category, profile.interests),
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        <button className={cn("pill", cat === "all" && "pill-active")} onClick={() => setCat("all")}>
          All
        </button>
        {SPOT_CATEGORIES.map((c) => (
          <button key={c.id} className={cn("pill", cat === c.id && "pill-active")} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {spots.length === 0 && (
        <p className="card p-8 text-center font-light text-muted">
          No spots yet for {city.name}. Finish your setup while signed in and the AI will suggest places that match your interests.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {spots.map((s) => (
          <article key={s.id} className="card flex flex-col p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="chip">{spotCategoryLabel(s.category)}</span>
                {spotMatches(s.category, profile.interests) && <ForYou />}
              </span>
              <Rating value={s.rating} />
            </div>
            <h3 className="mt-4 text-[22px] font-bold">{s.name}</h3>
            <p className="mt-1 text-[16px] font-light text-muted">{s.description}</p>
            <div className="mt-auto flex items-center justify-between pt-6">
              <span className="text-[16px] font-light text-muted">
                {s.area} · {s.price}
              </span>
              <a
                href={mapsUrl(s.name, city.name)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!integrations.googleMaps) {
                    e.preventDefault();
                    toast("Turn on Google Maps in Settings to open directions");
                  }
                }}
                className="inline-flex items-center gap-1.5 text-[16px] font-medium text-primary hover:underline"
              >
                <MapPin className="h-4 w-4" /> Map
              </a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/** Runs an async action, showing errors as a toast. */
async function attempt(fn: () => Promise<void>, ok?: string) {
  try {
    await fn();
    if (ok) toast(ok);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg && !msg.startsWith("Error:")) toast(msg);
  }
}

function Community() {
  const app = useApp();
  const { city, trips, meetups, profile, today } = app;
  const [posting, setPosting] = useState(false);
  const [hosting, setHosting] = useState(false);
  const upcomingMeetups = forYouFirst(
    meetups.filter((m) => m.date >= today),
    (m) => meetupMatches(m.category, profile.interests),
  );
  const upcomingTrips = trips.filter((t) => t.end >= today);

  return (
    <>
      {app.mode === "demo" && app.backendReady && (
        <p className="mb-6 rounded-3xl bg-lavender-soft px-5 py-3 text-[15px] text-ink/85">
          This is a sample board.{" "}
          <button className="font-medium text-primary underline" onClick={() => void app.signIn()}>
            Sign in with Google
          </button>{" "}
          to see and join real meetups and trips from students in {city.name}.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-2xl font-bold">
              <CalendarDays className="h-6 w-6 text-primary" /> Upcoming meetups
            </h2>
            <button className="btn-outline py-2 text-sm" onClick={() => setHosting(true)}>
              <Plus className="h-4 w-4" /> Host
            </button>
          </div>
          <div className="space-y-4">
            {upcomingMeetups.length === 0 && (
              <div className="card p-6 text-center text-muted">No meetups yet — host the first one!</div>
            )}
            {upcomingMeetups.map((m) => (
              <MeetupCard key={m.id} m={m} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-2xl font-bold">
              <Plane className="h-6 w-6 text-primary" /> Trip ideas board
            </h2>
            <button className="btn-primary" onClick={() => setPosting(true)}>
              <Plus className="h-[18px] w-[18px]" /> Post a trip
            </button>
          </div>
          <div className="space-y-4">
            {upcomingTrips.length === 0 && <div className="card p-6 text-center text-muted">No trips planned yet — post one!</div>}
            {upcomingTrips.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        </section>

        <PostTripModal open={posting} onClose={() => setPosting(false)} />
        <HostMeetupModal open={hosting} onClose={() => setHosting(false)} />
      </div>
    </>
  );
}

function MeetupCard({ m }: { m: MeetupView }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    await attempt(fn, ok);
    setBusy(false);
  };

  return (
    <article className="card p-5">
      <p className="flex items-center gap-2 text-sm text-primary">
        {m.category} {meetupMatches(m.category, app.profile.interests) && <ForYou />}
      </p>
      <h3 className="mt-0.5 text-xl font-medium">{m.title}</h3>
      <p className="text-sm font-light text-muted">
        {shortDate(m.date)} · {m.time} · {m.place}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="font-medium">{m.going} going</span>
        <div className="flex items-center gap-2">
          {m.hostedByMe && (
            <button
              aria-label="Delete meetup"
              disabled={busy}
              className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-cat-exam"
              onClick={() => window.confirm("Delete this meetup for everyone?") && void run(() => app.deleteMeetup(m.id), "Meetup deleted")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => void run(() => app.toggleRsvp(m.id), m.mine ? "RSVP removed" : "You're going! Added to your calendar")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60",
              m.mine ? "bg-primary text-white" : "bg-lavender text-primary hover:bg-primary/15",
            )}
          >
            {m.mine ? "Going ✓" : "RSVP"}
          </button>
        </div>
      </div>
    </article>
  );
}

function TripCard({ trip }: { trip: TripView }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const open = Math.max(trip.capacity - trip.people.length, 0);
  const full = open === 0 && !trip.joined;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    await attempt(fn, ok);
    setBusy(false);
  };

  return (
    <article className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[22px] font-bold">{trip.destination}</h3>
        <span className="chip shrink-0">{open > 0 ? `${open} ${open === 1 ? "spot" : "spots"} open` : "Full"}</span>
      </div>
      <p className="mt-1 font-light text-muted">
        {rangeLabel(trip.start, trip.end)} · ~€{trip.cost} · hosted by {trip.hostedByMe ? "you" : trip.host}
      </p>
      <p className="mt-3 text-[17px] text-ink/90">{trip.description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {trip.people.map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-lavender text-[11px] font-semibold text-primary"
              >
                {p}
              </span>
            ))}
          </div>
          <span className="text-[15px] text-muted">{trip.people.length} coming</span>
        </div>
        <div className="flex items-center gap-2">
          {trip.hostedByMe && (
            <button
              aria-label="Delete trip"
              disabled={busy}
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand hover:text-cat-exam"
              onClick={() => window.confirm("Delete this trip for everyone?") && void run(() => app.deleteTrip(trip.id), "Trip deleted")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() =>
              void run(() => app.toggleTrip(trip.id), trip.joined ? "You left the trip" : "You're in! Trip dates added to your calendar")
            }
            disabled={full || busy}
            className={cn(trip.joined ? "btn-outline" : "btn-primary", "shrink-0")}
          >
            {trip.joined ? "Joined ✓" : full ? "Trip full" : "Join / Interested"}
          </button>
        </div>
      </div>
    </article>
  );
}

const EMPTY_TRIP = { destination: "", start: "", end: "", cost: "", capacity: "4", description: "" };

function PostTripModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const [form, setForm] = useState(EMPTY_TRIP);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.destination.trim().length >= 2 && form.start && form.end && form.end >= form.start && form.start >= app.today;

  return (
    <Modal open={open} onClose={onClose} title="Post a trip idea">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          await attempt(
            () =>
              app.postTrip({
                destination: form.destination.trim(),
                start: form.start,
                end: form.end,
                cost: Math.max(Number(form.cost) || 0, 0),
                capacity: Math.min(Math.max(Number(form.capacity) || 2, 2), 50),
                description: form.description.trim().slice(0, 600) || "Details coming soon.",
              }),
            "Trip posted to the board",
          );
          setBusy(false);
          setForm(EMPTY_TRIP);
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Destination</span>
          <input className="input" maxLength={120} placeholder="e.g. Hamburg, Germany" value={form.destination} onChange={set("destination")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">From</span>
            <input type="date" className="input" min={app.today} value={form.start} onChange={set("start")} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">To</span>
            <input type="date" className="input" value={form.end} min={form.start || app.today} onChange={set("end")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Budget per person (€)</span>
            <input type="number" min="0" className="input" placeholder="100" value={form.cost} onChange={set("cost")} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Group size</span>
            <input type="number" min="2" max="50" className="input" value={form.capacity} onChange={set("capacity")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Plan</span>
          <textarea className="input min-h-[90px]" maxLength={600} placeholder="Transport, where to stay, what you want to do…" value={form.description} onChange={set("description")} />
        </label>
        <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
          {busy ? "Posting…" : "Post trip"}
        </button>
      </form>
    </Modal>
  );
}

const EMPTY_MEETUP = { category: MEETUP_CATEGORIES[0], title: "", date: "", time: "19:00", place: "" };

function HostMeetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const [form, setForm] = useState(EMPTY_MEETUP);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.title.trim().length >= 3 && form.place.trim().length >= 2 && form.date >= app.today && form.time;

  return (
    <Modal open={open} onClose={onClose} title="Host a meetup">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          await attempt(
            () => app.postMeetup({ ...form, title: form.title.trim(), place: form.place.trim() }),
            "Meetup posted — you're on the list",
          );
          setBusy(false);
          setForm(EMPTY_MEETUP);
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Type</span>
          <select className="input" value={form.category} onChange={set("category")}>
            {MEETUP_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Title</span>
          <input className="input" maxLength={120} placeholder="e.g. Sunday brunch & board games" value={form.title} onChange={set("title")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Date</span>
            <input type="date" className="input" min={app.today} value={form.date} onChange={set("date")} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Time</span>
            <input type="time" className="input" value={form.time} onChange={set("time")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Place</span>
          <input className="input" maxLength={160} placeholder="Café, park, library…" value={form.place} onChange={set("place")} />
        </label>
        <button type="submit" className="btn-primary w-full py-3" disabled={!valid || busy}>
          {busy ? "Posting…" : "Post meetup"}
        </button>
      </form>
    </Modal>
  );
}

function EssentialApps() {
  const app = useApp();
  const { city } = app;
  const [cat, setCat] = useState<AppCategory | "all">("all");
  const all = city.apps?.length ? city.apps : appsFor(city.id);
  const list = all
    .filter((a) => cat === "all" || a.category === cat)
    .sort((a, b) => Number(!!b.essential) - Number(!!a.essential));
  const got = all.filter((a) => app.isDone(a.id)).length;

  return (
    <>
      <div className="card mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Apps to download for {city.name}</h2>
          <p className="font-light text-muted">Install the starred ones before you fly. Tick each one once it's on your phone.</p>
        </div>
        <p className="shrink-0 text-[15px] text-muted">
          <span className="font-semibold text-primary">{got}</span> / {all.length} installed
        </p>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button className={cn("pill", cat === "all" && "pill-active")} onClick={() => setCat("all")}>
          All
        </button>
        {APP_CATEGORIES.map((c) => (
          <button key={c.id} className={cn("pill", cat === c.id && "pill-active")} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const done = app.isDone(a.id);
          return (
            <div key={a.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lavender font-display text-lg font-bold text-primary">
                  {a.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-lg font-bold">
                    <span className="truncate">{a.name}</span>
                    {a.essential && <Star className="h-4 w-4 shrink-0 fill-star text-star" aria-label="Must-have" />}
                  </p>
                  <span className="chip text-[12px]">{APP_CATEGORIES.find((c) => c.id === a.category)!.label}</span>
                </div>
              </div>
              <p className="mt-3 flex-1 font-light text-muted">{a.why}</p>
              <div className="mt-4 flex gap-2">
                <a href={storeLink(a.name)} target="_blank" rel="noreferrer" className="btn-outline flex-1 whitespace-nowrap px-3 py-2 text-sm">
                  <Download className="h-4 w-4" /> Get app
                </a>
                <button
                  className={cn(done ? "btn-primary" : "btn-outline", "flex-1 whitespace-nowrap px-3 py-2 text-sm")}
                  onClick={() => void app.toggleTask(a.id)}
                >
                  <Check className="h-4 w-4" /> {done ? "Installed" : "I have it"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
