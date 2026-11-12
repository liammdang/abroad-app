import { ArrowRight, CircleCheck, Clock, Lock, MapPin, Plane, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconBubble, ProgressBar, Rating, cn } from "@/components/ui";
import { SPOT_CATEGORIES, spotCategoryLabel } from "@/data/cities";
import { heroDate, rangeLabel, shortDate, stampDate, stayLabel } from "@/lib/date";
import { forYouFirst, meetupMatches, spotMatches } from "@/lib/personalize";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

function CardHeader({ icon, title, to }: { icon: React.ReactNode; title: string; to: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <IconBubble>{icon}</IconBubble>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <Link to={to} aria-label={`Open ${title}`} className="grid h-9 w-9 place-items-center rounded-full text-ink/70 hover:bg-sand">
        <ArrowRight className="h-5 w-5" />
      </Link>
    </div>
  );
}

export function ForYou() {
  return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">For you</span>;
}

export default function Home() {
  const app = useApp();
  const { city, profile, events, isDone, trips, meetups, today } = app;

  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= today).slice(0, 3);

  const arrival = city.phases.filter((p) => p.id === "pre" || p.id === "first14").flatMap((p) => p.items);
  const arrivalDone = arrival.filter((t) => isDone(t.id)).length;
  const nextStep = arrival.find((t) => !isDone(t.id)) ?? city.phases.flatMap((p) => p.items).find((t) => !isDone(t.id));

  // one spot per category, categories you're interested in first
  const cats = forYouFirst(SPOT_CATEGORIES, (c) => spotMatches(c.id, profile.interests)).slice(0, 3);
  const spotlight = cats
    .map((c) => city.spots.filter((s) => s.category === c.id).sort((a, b) => b.rating - a.rating)[0])
    .filter(Boolean);

  const upcomingMeetups = forYouFirst(
    meetups.filter((m) => m.date >= today),
    (m) => meetupMatches(m.category, profile.interests),
  ).slice(0, 2);
  const trip = trips.find((t) => t.end >= today);

  return (
    <div className="space-y-6">
      {app.mode === "demo" && app.backendReady && (
        <div className="flex flex-col gap-3 rounded-3xl border border-primary/15 bg-lavender-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-ink/85">
            <span className="font-semibold text-primary">Demo mode</span> — you're looking at sample data. Sign in to use your own calendar,
            inbox and the shared community board.
          </p>
          <button className="btn-primary shrink-0" onClick={() => void app.signIn()}>
            Sign in with Google
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-primary via-primary to-primary-light px-7 py-9 text-white md:px-10 md:py-11">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rounded-full bg-white/5" />
        <p className="text-[15px] font-light text-white/85">
          {heroDate(today)} · {city.flag} {city.name} · {stayLabel(today, profile.start, profile.end)}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {city.greeting}, {profile.name} <span className="inline-block">👋</span>
        </h1>
        <p className="mt-3 max-w-xl text-lg font-light leading-relaxed text-white/85">
          Your life abroad, in one place. Here's what matters today at {profile.university}.
        </p>
        <Link to="/onboarding" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-medium text-primary transition hover:bg-lavender">
          Personalize your setup <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's view */}
        <section className="card p-6">
          <CardHeader icon={<Clock className="h-[18px] w-[18px]" />} title="Today's view" to="/calendar" />
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-muted">
                Nothing coming up yet.{" "}
                <Link to="/calendar" className="text-primary underline">
                  Import your timetable
                </Link>
              </p>
            )}
            {upcoming.map((e, i) => {
              const isNext = i === 0 && e.date <= today;
              return (
                <div key={e.id} className={cn("rounded-3xl px-4 py-3.5", isNext ? "bg-lavender" : "bg-sand")}>
                  <p className="text-[13px] font-medium tracking-wide text-primary">
                    {isNext ? "UP NEXT" : stampDate(e.date)}
                    {e.time ? ` · ${e.time}` : ""}
                  </p>
                  <p className="mt-0.5 text-[17px] leading-snug text-ink">{e.title}</p>
                  {e.place && <p className="mt-0.5 text-sm font-light text-muted">{e.place}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Life admin progress */}
        <section className="card p-6">
          <CardHeader icon={<CircleCheck className="h-[18px] w-[18px]" />} title="Life admin progress" to="/life-admin" />
          <div className="flex items-baseline gap-3">
            <span className="font-display text-6xl font-bold text-primary">{arrivalDone}</span>
            <span className="text-lg text-muted">of {arrival.length} arrival steps done</span>
          </div>
          <ProgressBar value={arrival.length ? arrivalDone / arrival.length : 0} className="mt-4" />
          {nextStep && (
            <div className="mt-6 rounded-3xl border border-dashed border-line px-4 py-3.5">
              <p className="text-sm text-muted">Next step</p>
              <p className="text-[17px] text-ink">{nextStep.title}</p>
            </div>
          )}
          <Link to="/life-admin" className="mt-6 inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            Open checklists <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Explore spotlight */}
        <section className="card p-6">
          <CardHeader icon={<MapPin className="h-[18px] w-[18px]" />} title="Explore spotlight" to="/explore" />
          <div className="space-y-3">
            {spotlight.map((s) => (
              <Link key={s.id} to="/explore" className="block rounded-3xl bg-sand px-4 py-3.5 transition hover:bg-lavender-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm text-primary">
                    {spotCategoryLabel(s.category)} {spotMatches(s.category, profile.interests) && <ForYou />}
                  </p>
                  <Rating value={s.rating} />
                </div>
                <p className="text-[17px] text-ink">{s.name}</p>
                <p className="text-sm font-light text-muted">
                  {s.area} · {s.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Community highlights */}
        <section className="card p-6 lg:col-span-2">
          <CardHeader icon={<Users className="h-[18px] w-[18px]" />} title="Community highlights" to="/explore?tab=community" />
          {upcomingMeetups.length === 0 && !trip && (
            <p className="text-muted">
              No meetups yet in {city.name}.{" "}
              <Link to="/explore?tab=community" className="text-primary underline">
                Host the first one
              </Link>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingMeetups.map((m) => (
              <div key={m.id} className="rounded-3xl bg-sand px-5 py-4">
                <p className="flex items-center gap-2 text-sm text-primary">
                  {m.category} {meetupMatches(m.category, profile.interests) && <ForYou />}
                </p>
                <p className="mt-1 text-lg text-ink">{m.title}</p>
                <p className="text-sm font-light text-muted">
                  {shortDate(m.date)} · {m.time} · {m.place}
                </p>
                <p className="mt-2 text-sm font-medium text-ink">{m.going} students going</p>
              </div>
            ))}
          </div>
          {trip && (
            <Link to="/explore?tab=community" className="mt-3 block rounded-3xl border-2 border-dashed border-line px-5 py-4 transition hover:border-primary/30">
              <p className="flex items-center gap-2 text-sm text-primary">
                <Plane className="h-4 w-4" /> Trip idea
              </p>
              <p className="mt-1 text-lg text-ink">
                {trip.destination} · {rangeLabel(trip.start, trip.end)}
              </p>
              <p className="text-sm font-light text-muted">
                {trip.people.length} going · {Math.max(trip.capacity - trip.people.length, 0)} spots open · ~€{trip.cost}
              </p>
            </Link>
          )}
        </section>

        <AiCard />
      </div>
    </div>
  );
}

function AiCard() {
  const app = useApp();
  const { city } = app;
  const navigate = useNavigate();
  const live = app.mode === "live";
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const askEmail = app.mode === "demo" && app.backendReady && !app.waitlist;

  const join = async () => {
    setBusy(true);
    try {
      await app.joinWaitlist(email);
      toast("You're on the waitlist — we'll email you when it launches!");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col bg-lavender-soft p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" /> AI Companion
        </span>
        {live ? (
          <Link to="/assistant" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Open chat <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted">
            <Lock className="h-3.5 w-3.5" /> {app.backendReady ? "Sign in to chat" : "Premium · soon"}
          </span>
        )}
      </div>
      <h2 className="text-2xl font-bold leading-tight">Ask anything about life in {city.name}</h2>
      <div className="mt-5 flex justify-end">
        <p className="max-w-[90%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-white">{city.ai.question}</p>
      </div>
      <div className="mt-3 flex">
        <p className="max-w-[90%] rounded-3xl rounded-bl-lg bg-white px-4 py-2.5 text-ink">{city.ai.answer}</p>
      </div>
      {live ? (
        <form
          className="mt-auto flex gap-2 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const q = question.trim();
            navigate(q ? `/assistant?q=${encodeURIComponent(q)}` : "/assistant");
          }}
        >
          <input className="input flex-1 py-2.5" placeholder="Type your question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button type="submit" className="btn-primary h-11 w-11 shrink-0 p-0" aria-label="Ask">
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <form
          className="mt-auto space-y-2 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          {askEmail && (
            <input
              type="email"
              required
              className="input py-2.5"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <button type="submit" className="btn-primary w-full py-3" disabled={app.waitlist || busy}>
            {app.waitlist ? "You're on the waitlist ✓" : busy ? "Joining…" : "Join the waitlist"}
          </button>
        </form>
      )}
    </section>
  );
}
