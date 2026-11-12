import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { builtInCity, cityFromPack, genericCity } from "@/data/cities";
import type { CalEvent, City, CityId, CityPack, Meetup, Trip } from "@/data/types";
import { addDays, setRealToday, todayISO } from "@/lib/date";
import {
  clearGoogleToken,
  connectGoogle,
  ensureAbroadCalendar,
  hasFeature,
  listGoogleEvents,
  pushToGoogle,
  rememberProviderTokens,
  revokeGoogle,
  type GoogleFeature,
} from "@/lib/google";
import { parseICS } from "@/lib/ics";
import { backendReady, functionError, supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";

/**
 * Two modes:
 *  - "demo": not signed in. Sample city data, everything saved in localStorage.
 *  - "live": signed in with Google. Profile, progress, community, calendar and
 *            inbox are real (Supabase + Google APIs).
 * Pages only talk to this hook, so they work the same in both modes.
 */

export interface Profile {
  name: string;
  cityId: CityId;
  university: string;
  start: string;
  end: string;
  interests: string[];
  /** display name + country for cities without hand-made content */
  cityName?: string;
  country?: string;
  /** nationality / home country — drives visa & paperwork advice */
  homeCountry?: string;
  program?: string;
  /** free text the student wants the AI to know */
  about?: string;
  /** AI-generated content for this student (null = not personalized yet) */
  pack?: CityPack | null;
}

export type NewEvent = Pick<CalEvent, "title" | "date" | "time" | "place" | "category">;

export interface Integrations {
  googleCalendar: boolean;
  googleMaps: boolean;
  smartEmail: boolean;
  abroadCalendarId?: string;
  lastSync?: string;
}

export interface MeetupView extends Meetup {
  mine: boolean;
  hostedByMe: boolean;
}

export interface TripView extends Trip {
  people: string[];
  joined: boolean;
  hostedByMe: boolean;
}

export type NewTrip = Pick<Trip, "destination" | "start" | "end" | "cost" | "capacity" | "description">;
export type NewMeetup = Pick<Meetup, "category" | "title" | "date" | "time" | "place">;

/* ───────────── Demo (local) state ───────────── */

interface DemoState {
  profile: Profile;
  done: string[];
  rsvps: string[];
  joinedTrips: string[];
  postedTrips: (Trip & { cityId: CityId })[];
  postedMeetups: (Meetup & { cityId: CityId })[];
  importedEvents: CalEvent[];
  integrations: Integrations;
  waitlist: boolean;
}

const STORAGE_KEY = "abroad:v1";
const PENDING_KEY = "abroad:pendingIntegration";

const DEFAULT_PROFILE: Profile = {
  name: "Priscylla",
  cityId: "berlin",
  university: "Freie Universität Berlin",
  start: "2026-10-01",
  end: "2027-02-28",
  interests: ["Coffee & Study", "Budget Travel", "Language Exchange"],
};

const DEFAULT_DEMO: DemoState = {
  profile: DEFAULT_PROFILE,
  done: ["be-visa", "be-insurance", "be-housing"],
  rsvps: ["be-m1"],
  joinedTrips: ["be-t1"],
  postedTrips: [],
  postedMeetups: [],
  importedEvents: [],
  integrations: { googleCalendar: true, googleMaps: true, smartEmail: false },
  waitlist: false,
};

function loadDemo(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_DEMO, ...JSON.parse(raw) } : DEFAULT_DEMO;
  } catch {
    return DEFAULT_DEMO;
  }
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

/* ───────────── Live (Supabase) state ───────────── */

interface LiveState {
  loaded: boolean;
  profile: Profile | null;
  integrations: Integrations;
  done: string[];
  userEvents: CalEvent[];
  feeds: string[];
  waitlist: boolean;
}

const EMPTY_LIVE: LiveState = {
  loaded: false,
  profile: null,
  integrations: { googleCalendar: false, googleMaps: true, smartEmail: false },
  done: [],
  userEvents: [],
  feeds: [],
  waitlist: false,
};

interface MeetupRow {
  id: string;
  city_id: string;
  category: string;
  title: string;
  date: string;
  time: string;
  place: string;
  host_id: string | null;
  host_name: string;
  meetup_rsvps: { user_id: string }[];
}

interface TripRow {
  id: string;
  city_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  cost: number;
  capacity: number;
  description: string;
  host_id: string | null;
  host_name: string;
  trip_members: { user_id: string; initials: string }[];
}

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? "Me").slice(0, 2).toUpperCase();
};

/* ───────────── Context ───────────── */

interface AppStateValue {
  mode: "demo" | "live";
  backendReady: boolean;
  authReady: boolean;
  userEmail: string | null;
  needsOnboarding: boolean;
  today: string;

  profile: Profile;
  city: City;
  initials: string;
  integrations: Integrations;
  googleConnected: Record<GoogleFeature, boolean>;

  events: CalEvent[];
  googleError: string | null;
  meetups: MeetupView[];
  trips: TripView[];
  importedCount: number;
  feeds: string[];
  waitlist: boolean;

  isDone: (taskId: string) => boolean;
  toggleTask: (taskId: string) => Promise<void>;
  toggleRsvp: (meetupId: string) => Promise<void>;
  toggleTrip: (tripId: string) => Promise<void>;
  postTrip: (trip: NewTrip) => Promise<void>;
  postMeetup: (m: NewMeetup) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  deleteMeetup: (id: string) => Promise<void>;
  importEvents: (events: CalEvent[]) => Promise<void>;
  addEvent: (e: NewEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  clearImported: () => Promise<void>;
  addFeed: (url: string) => Promise<number>;
  removeFeed: (url: string) => Promise<void>;
  setIntegration: (key: "googleCalendar" | "googleMaps" | "smartEmail", value: boolean) => Promise<void>;
  syncGoogle: () => Promise<void>;
  setProfile: (profile: Profile) => Promise<void>;
  joinWaitlist: (email?: string) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetDemo: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function AppStateProvider({ children }: { children: ReactNode }) {
  /* demo */
  const [demo, setDemo] = useState<DemoState>(loadDemo);
  useEffect(() => ls.set(STORAGE_KEY, JSON.stringify(demo)), [demo]);

  /* auth */
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [scopeTick, setScopeTick] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    const handle = async (s: Session | null) => {
      if (s?.provider_token) {
        await rememberProviderTokens(s.provider_token, s.provider_refresh_token);
        setScopeTick((n) => n + 1);
      }
    };
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await handle(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void handle(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id ?? null;
  const mode: "demo" | "live" = uid ? "live" : "demo";
  setRealToday(mode === "live");
  const today = todayISO();

  /* live data */
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE);
  const [meetupRows, setMeetupRows] = useState<MeetupRow[]>([]);
  const [tripRows, setTripRows] = useState<TripRow[]>([]);
  const [feedEvents, setFeedEvents] = useState<CalEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalEvent[]>([]);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const loadLive = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [prof, done, evts, feeds, wait] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("task_progress").select("task_id").eq("user_id", userId),
      supabase.from("user_events").select("*").eq("user_id", userId),
      supabase.from("ical_feeds").select("url").eq("user_id", userId),
      Promise.resolve(ls.get(`abroad:waitlist:${userId}`) === "1"),
    ]);
    const p = prof.data;
    setLive({
      loaded: true,
      profile: p
        ? {
            name: p.name,
            cityId: p.city_id,
            university: p.university,
            start: p.start_date,
            end: p.end_date,
            interests: p.interests ?? [],
            cityName: p.city_name ?? undefined,
            country: p.country ?? undefined,
            homeCountry: p.home_country ?? undefined,
            program: p.program ?? undefined,
            about: p.about ?? undefined,
            pack: (p.city_pack as CityPack | null) ?? null,
          }
        : null,
      integrations: { ...EMPTY_LIVE.integrations, ...(p?.integrations ?? {}) },
      done: (done.data ?? []).map((r) => r.task_id),
      userEvents: (evts.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        endDate: r.end_date ?? undefined,
        time: r.time ?? undefined,
        place: r.place ?? undefined,
        category: r.category,
        source: String(r.id).startsWith("manual-") ? ("manual" as const) : ("upload" as const),
      })),
      feeds: (feeds.data ?? []).map((r) => r.url),
      waitlist: wait,
    });
  }, []);

  useEffect(() => {
    if (uid) void loadLive(uid);
    else {
      setLive(EMPTY_LIVE);
      setMeetupRows([]);
      setTripRows([]);
      setFeedEvents([]);
      setGoogleEvents([]);
    }
  }, [uid, loadLive]);

  const userMeta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const profile: Profile =
    mode === "live"
      ? live.profile ?? { ...DEFAULT_PROFILE, name: (userMeta?.full_name ?? userMeta?.name ?? "").split(" ")[0] || "" }
      : demo.profile;
  const city: City = useMemo(() => {
    if (profile.pack) return cityFromPack(profile.pack, profile.university);
    return builtInCity(profile.cityId) ?? genericCity(profile.cityName ?? profile.cityId, profile.country ?? "", profile.university);
  }, [profile.pack, profile.university, profile.cityId, profile.cityName, profile.country]);
  const integrations = mode === "live" ? live.integrations : demo.integrations;
  const initials = useMemo(() => initialsOf(profile.name), [profile.name]);

  const loadCommunity = useCallback(async () => {
    if (!supabase || !uid) return;
    const [m, t] = await Promise.all([
      supabase.from("meetups").select("*, meetup_rsvps(user_id)").eq("city_id", city.id).order("date"),
      supabase.from("trips").select("*, trip_members(user_id, initials)").eq("city_id", city.id).order("start_date"),
    ]);
    if (m.error || t.error) toast("Could not load the community board");
    setMeetupRows((m.data as MeetupRow[]) ?? []);
    setTripRows((t.data as TripRow[]) ?? []);
  }, [uid, city.id]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  /* realtime: refresh the board when anyone changes it */
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    const ch = sb
      .channel("community")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetups" }, () => void loadCommunity())
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_rsvps" }, () => void loadCommunity())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => void loadCommunity())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members" }, () => void loadCommunity())
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [uid, loadCommunity]);

  /* iCal feeds (via edge function) */
  useEffect(() => {
    if (!supabase || mode !== "live" || live.feeds.length === 0) {
      setFeedEvents([]);
      return;
    }
    const sb = supabase;
    let cancelled = false;
    (async () => {
      const all: CalEvent[] = [];
      for (const [i, url] of live.feeds.entries()) {
        const { data, error } = await sb.functions.invoke("ical-proxy", { body: { url } });
        if (error) {
          toast(`iCal feed failed: ${await functionError(error)}`);
          continue;
        }
        all.push(...parseICS(data.ics, `feed${i}`));
      }
      if (!cancelled) setFeedEvents(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, live.feeds]);

  const googleConnected = useMemo(
    () => ({ calendar: mode === "live" && hasFeature("calendar"), gmail: mode === "live" && hasFeature("gmail") }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, scopeTick],
  );

  /* Google Calendar events */
  const loadGoogleEvents = useCallback(async () => {
    if (mode !== "live" || !integrations.googleCalendar || !hasFeature("calendar")) {
      setGoogleEvents([]);
      return;
    }
    try {
      setGoogleEvents(await listGoogleEvents(addDays(profile.start, -14), addDays(profile.end, 14)));
      setGoogleError(null);
    } catch (e) {
      setGoogleError((e as Error).message);
    }
  }, [mode, integrations.googleCalendar, profile.start, profile.end]);

  useEffect(() => {
    void loadGoogleEvents();
  }, [loadGoogleEvents, scopeTick]);

  /* ── community views ── */
  const meetups: MeetupView[] = useMemo(() => {
    if (mode === "live")
      return meetupRows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        date: r.date,
        time: r.time,
        place: r.place,
        going: r.meetup_rsvps.length,
        mine: r.meetup_rsvps.some((x) => x.user_id === uid),
        hostedByMe: r.host_id === uid,
      }));
    const all = [...city.meetups, ...demo.postedMeetups.filter((m) => m.cityId === city.id)];
    return all
      .map((m) => {
        const mine = demo.rsvps.includes(m.id);
        return { ...m, going: m.going + (mine ? 1 : 0), mine, hostedByMe: m.id.startsWith("post-") };
      })
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [mode, meetupRows, uid, city, demo.postedMeetups, demo.rsvps]);

  const trips: TripView[] = useMemo(() => {
    if (mode === "live")
      return tripRows.map((r) => ({
        id: r.id,
        destination: r.destination,
        start: r.start_date,
        end: r.end_date,
        cost: r.cost,
        capacity: r.capacity,
        description: r.description,
        host: r.host_name,
        attendees: [],
        people: r.trip_members.map((m) => m.initials),
        joined: r.trip_members.some((m) => m.user_id === uid),
        hostedByMe: r.host_id === uid,
      }));
    return [...city.trips, ...demo.postedTrips.filter((t) => t.cityId === city.id)].map((t) => {
      const joined = demo.joinedTrips.includes(t.id);
      return { ...t, people: joined ? [...t.attendees, initials] : t.attendees, joined, hostedByMe: t.id.startsWith("post-") };
    });
  }, [mode, tripRows, uid, city, demo.postedTrips, demo.joinedTrips, initials]);

  /* ── events (everything that goes on the calendar) ── */
  const ownEvents = useMemo<CalEvent[]>(() => {
    const stay: CalEvent[] = [
      { id: `stay-arrive-${profile.cityId}-${profile.start}`, title: `Arrival in ${city.name}`, date: profile.start, category: "travel", source: "stay" },
      { id: `stay-leave-${profile.cityId}-${profile.end}`, title: `Departure from ${city.name}`, date: profile.end, category: "travel", source: "stay" },
    ];
    const tripEvents: CalEvent[] = trips
      .filter((t) => t.joined)
      .map((t) => ({
        id: `trip-${t.id}`,
        title: `Trip: ${t.destination}`,
        date: t.start,
        endDate: t.end > t.start ? t.end : undefined,
        category: "travel",
        place: `hosted by ${t.host}`,
        source: "trip",
      }));
    const meetupEvents: CalEvent[] = meetups
      .filter((m) => m.mine)
      .map((m) => ({ id: `meetup-${m.id}`, title: m.title, date: m.date, time: m.time, place: m.place, category: "social", source: "meetup" }));
    // key dates from the AI plan (e.g. "Register your address by …") go on the calendar automatically
    const planEvents: CalEvent[] = (city.keyDates ?? []).map((k, i) => ({
      id: `plan-${city.id}-${i}-${k.date}`,
      title: k.title,
      date: k.date,
      category: k.category,
      source: "plan",
    }));
    const base = mode === "live" ? [...live.userEvents, ...feedEvents] : [...city.events, ...demo.importedEvents];
    return [...stay, ...planEvents, ...base, ...tripEvents, ...meetupEvents];
  }, [profile, city, trips, meetups, mode, live.userEvents, feedEvents, demo.importedEvents]);

  const events = useMemo(
    () =>
      [...ownEvents, ...googleEvents].sort((a, b) =>
        `${a.date} ${a.time ?? "00:00"}`.localeCompare(`${b.date} ${b.time ?? "00:00"}`),
      ),
    [ownEvents, googleEvents],
  );

  /* ── helpers ── */
  const requireDb = () => {
    if (!supabase || !uid) throw new Error("Not signed in");
    return { sb: supabase, uid };
  };
  const report = (error: { message: string } | null) => {
    if (error) {
      toast(error.message.includes("full") ? "Sorry, this trip is full" : `Error: ${error.message}`);
      throw error;
    }
  };

  const saveIntegrations = async (next: Integrations) => {
    if (mode === "demo") {
      setDemo((s) => ({ ...s, integrations: next }));
      return;
    }
    const { sb } = requireDb();
    setLive((l) => ({ ...l, integrations: next }));
    if (live.profile) await sb.from("profiles").update({ integrations: next, updated_at: new Date().toISOString() }).eq("id", uid!);
  };

  /* After returning from Google with new scopes, switch on the integration the user asked for. */
  useEffect(() => {
    if (mode !== "live" || !live.loaded || !live.profile) return;
    const pending = ls.get(PENDING_KEY) as "googleCalendar" | "smartEmail" | null;
    if (!pending) return;
    const feature: GoogleFeature = pending === "googleCalendar" ? "calendar" : "gmail";
    ls.del(PENDING_KEY);
    if (hasFeature(feature)) {
      void saveIntegrations({ ...live.integrations, [pending]: true });
      toast(pending === "googleCalendar" ? "Google Calendar connected" : "Smart Email connected");
    } else {
      toast("Google didn't grant access — please tick the permission box");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, live.loaded, live.profile, scopeTick]);

  const value: AppStateValue = {
    mode,
    backendReady,
    authReady,
    userEmail: session?.user.email ?? null,
    needsOnboarding: mode === "live" && live.loaded && !live.profile,
    today,
    profile,
    city,
    initials,
    integrations,
    googleConnected,
    events,
    googleError,
    meetups,
    trips,
    importedCount: (mode === "live" ? live.userEvents : demo.importedEvents).filter((e) => !e.id.startsWith("manual-")).length,
    feeds: mode === "live" ? live.feeds : [],
    waitlist: mode === "live" ? live.waitlist : demo.waitlist,

    isDone: (id) => (mode === "live" ? live.done : demo.done).includes(id),

    toggleTask: async (id) => {
      if (mode === "demo") return setDemo((s) => ({ ...s, done: toggleIn(s.done, id) }));
      const { sb, uid: u } = requireDb();
      const was = live.done.includes(id);
      setLive((l) => ({ ...l, done: toggleIn(l.done, id) }));
      const { error } = was
        ? await sb.from("task_progress").delete().eq("user_id", u).eq("task_id", id)
        : await sb.from("task_progress").insert({ user_id: u, task_id: id });
      if (error) {
        setLive((l) => ({ ...l, done: toggleIn(l.done, id) }));
        report(error);
      }
    },

    toggleRsvp: async (id) => {
      if (mode === "demo") return setDemo((s) => ({ ...s, rsvps: toggleIn(s.rsvps, id) }));
      const { sb, uid: u } = requireDb();
      const mine = meetups.find((m) => m.id === id)?.mine;
      const { error } = mine
        ? await sb.from("meetup_rsvps").delete().eq("meetup_id", id).eq("user_id", u)
        : await sb.from("meetup_rsvps").insert({ meetup_id: id, user_id: u });
      report(error);
      await loadCommunity();
    },

    toggleTrip: async (id) => {
      if (mode === "demo") return setDemo((s) => ({ ...s, joinedTrips: toggleIn(s.joinedTrips, id) }));
      const { sb, uid: u } = requireDb();
      const joined = trips.find((t) => t.id === id)?.joined;
      const { error } = joined
        ? await sb.from("trip_members").delete().eq("trip_id", id).eq("user_id", u)
        : await sb.from("trip_members").insert({ trip_id: id, user_id: u, initials });
      report(error);
      await loadCommunity();
    },

    postTrip: async (t) => {
      if (mode === "demo") {
        const id = `post-${Date.now()}`;
        return setDemo((s) => ({
          ...s,
          postedTrips: [...s.postedTrips, { ...t, id, host: s.profile.name, attendees: [], cityId: s.profile.cityId }],
          joinedTrips: [...s.joinedTrips, id],
        }));
      }
      const { sb, uid: u } = requireDb();
      const { data, error } = await sb
        .from("trips")
        .insert({
          city_id: city.id,
          destination: t.destination,
          start_date: t.start,
          end_date: t.end,
          cost: t.cost,
          capacity: t.capacity,
          description: t.description,
          host_id: u,
          host_name: profile.name,
        })
        .select("id")
        .single();
      report(error);
      report((await sb.from("trip_members").insert({ trip_id: data!.id, user_id: u, initials })).error);
      await loadCommunity();
    },

    postMeetup: async (m) => {
      if (mode === "demo") {
        const id = `post-${Date.now()}`;
        return setDemo((s) => ({
          ...s,
          postedMeetups: [...s.postedMeetups, { ...m, id, going: 0, cityId: s.profile.cityId }],
          rsvps: [...s.rsvps, id],
        }));
      }
      const { sb, uid: u } = requireDb();
      const { data, error } = await sb
        .from("meetups")
        .insert({ ...m, city_id: city.id, host_id: u, host_name: profile.name })
        .select("id")
        .single();
      report(error);
      report((await sb.from("meetup_rsvps").insert({ meetup_id: data!.id, user_id: u })).error);
      await loadCommunity();
    },

    deleteTrip: async (id) => {
      if (mode === "demo")
        return setDemo((s) => ({ ...s, postedTrips: s.postedTrips.filter((t) => t.id !== id), joinedTrips: s.joinedTrips.filter((x) => x !== id) }));
      const { sb } = requireDb();
      report((await sb.from("trips").delete().eq("id", id)).error);
      await loadCommunity();
    },

    deleteMeetup: async (id) => {
      if (mode === "demo")
        return setDemo((s) => ({ ...s, postedMeetups: s.postedMeetups.filter((m) => m.id !== id), rsvps: s.rsvps.filter((x) => x !== id) }));
      const { sb } = requireDb();
      report((await sb.from("meetups").delete().eq("id", id)).error);
      await loadCommunity();
    },

    importEvents: async (evts) => {
      const withSource = evts.map((e) => ({ ...e, source: "upload" as const }));
      if (mode === "demo") {
        return setDemo((s) => {
          const existing = new Set(s.importedEvents.map((e) => e.id));
          return { ...s, importedEvents: [...s.importedEvents, ...withSource.filter((e) => !existing.has(e.id))] };
        });
      }
      const { sb, uid: u } = requireDb();
      const rows = withSource.map((e) => ({
        user_id: u,
        id: e.id,
        title: e.title,
        date: e.date,
        end_date: e.endDate ?? null,
        time: e.time ?? null,
        place: e.place ?? null,
        category: e.category,
      }));
      report((await sb.from("user_events").upsert(rows)).error);
      await loadLive(u);
    },

    addEvent: async (e) => {
      const ev: CalEvent = { ...e, id: `manual-${Date.now()}`, source: "manual" };
      if (mode === "demo") return setDemo((s) => ({ ...s, importedEvents: [...s.importedEvents, ev] }));
      const { sb, uid: u } = requireDb();
      report(
        (
          await sb.from("user_events").insert({
            user_id: u,
            id: ev.id,
            title: ev.title,
            date: ev.date,
            time: ev.time || null,
            place: ev.place || null,
            category: ev.category,
          })
        ).error,
      );
      await loadLive(u);
    },

    deleteEvent: async (id) => {
      if (mode === "demo") return setDemo((s) => ({ ...s, importedEvents: s.importedEvents.filter((e) => e.id !== id) }));
      const { sb, uid: u } = requireDb();
      report((await sb.from("user_events").delete().eq("user_id", u).eq("id", id)).error);
      await loadLive(u);
    },

    clearImported: async () => {
      if (mode === "demo") return setDemo((s) => ({ ...s, importedEvents: s.importedEvents.filter((e) => e.id.startsWith("manual-")) }));
      const { sb, uid: u } = requireDb();
      report((await sb.from("user_events").delete().eq("user_id", u).not("id", "like", "manual-%")).error);
      await loadLive(u);
    },

    addFeed: async (url) => {
      const { sb, uid: u } = requireDb();
      const { data, error } = await sb.functions.invoke("ical-proxy", { body: { url } });
      if (error) throw new Error(await functionError(error));
      const count = parseICS(data.ics).length;
      report((await sb.from("ical_feeds").upsert({ user_id: u, url }, { onConflict: "user_id,url" })).error);
      await loadLive(u);
      return count;
    },

    removeFeed: async (url) => {
      const { sb, uid: u } = requireDb();
      report((await sb.from("ical_feeds").delete().eq("user_id", u).eq("url", url)).error);
      await loadLive(u);
    },

    setIntegration: async (key, v) => {
      if (key === "googleMaps") return saveIntegrations({ ...integrations, googleMaps: v });
      const feature: GoogleFeature = key === "googleCalendar" ? "calendar" : "gmail";
      if (mode === "demo") {
        if (v && backendReady) {
          toast("Sign in with Google to connect your real account");
          return;
        }
        return saveIntegrations({ ...integrations, [key]: v });
      }
      if (v && !hasFeature(feature)) {
        ls.set(PENDING_KEY, key);
        await connectGoogle([feature]);
        return;
      }
      await saveIntegrations({ ...integrations, [key]: v });
    },

    syncGoogle: async () => {
      if (mode === "demo") {
        toast(backendReady ? "Sign in with Google to sync your real calendar" : "Connect a backend to sync (see SETUP.md)");
        return;
      }
      if (!integrations.googleCalendar || !hasFeature("calendar")) {
        toast("Turn on Google Calendar in Settings first");
        return;
      }
      const calId = await ensureAbroadCalendar(integrations.abroadCalendarId);
      const pushable = ownEvents.filter((e) => e.source !== "google");
      const added = await pushToGoogle(calId, pushable);
      await saveIntegrations({ ...integrations, abroadCalendarId: calId, lastSync: new Date().toISOString() });
      await loadGoogleEvents();
      toast(added ? `Synced — ${added} new events added to your "Abroad" Google calendar` : "Everything is already in sync");
    },

    setProfile: async (p) => {
      if (mode === "demo") return setDemo((s) => ({ ...s, profile: p }));
      const { sb, uid: u } = requireDb();
      const { error } = await sb.from("profiles").upsert({
        id: u,
        name: p.name,
        city_id: p.cityId,
        university: p.university,
        start_date: p.start,
        end_date: p.end,
        interests: p.interests,
        city_name: p.cityName ?? null,
        country: p.country ?? null,
        home_country: p.homeCountry ?? null,
        program: p.program ?? null,
        about: p.about ?? null,
        city_pack: p.pack ?? null,
        integrations: live.integrations,
        updated_at: new Date().toISOString(),
      });
      report(error);
      setLive((l) => ({ ...l, profile: p }));
    },

    joinWaitlist: async (email) => {
      const address = (mode === "live" ? session?.user.email : email)?.trim().toLowerCase();
      if (!supabase) {
        setDemo((s) => ({ ...s, waitlist: true }));
        return;
      }
      if (!address) throw new Error("Please enter your email");
      const { error } = await supabase.from("waitlist").insert({ email: address, user_id: uid, city_id: city.id });
      if (error && error.code !== "23505") throw new Error(error.message.includes("check") ? "Please enter a valid email" : error.message);
      if (mode === "live") {
        ls.set(`abroad:waitlist:${uid}`, "1");
        setLive((l) => ({ ...l, waitlist: true }));
      } else setDemo((s) => ({ ...s, waitlist: true }));
    },

    signIn: async () => {
      try {
        await connectGoogle([]);
      } catch (e) {
        toast((e as Error).message);
      }
    },

    signOut: async () => {
      if (!supabase) return;
      await revokeGoogle().catch(() => clearGoogleToken());
      await supabase.auth.signOut();
      toast("Signed out");
    },

    resetDemo: () => setDemo(DEFAULT_DEMO),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
