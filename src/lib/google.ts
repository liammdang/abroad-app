import type { CalEvent, Mail, MailFolder } from "@/data/types";
import { functionError, supabase } from "./supabase";
import { addDays, toISO } from "./date";
import { guessCategory } from "./ics";

export const GOOGLE_SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
} as const;
export type GoogleFeature = keyof typeof GOOGLE_SCOPES;

const TOKEN_KEY = "abroad:gtoken";
interface CachedToken {
  token: string;
  exp: number;
  scope: string;
}

function readToken(): CachedToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as CachedToken) : null;
  } catch {
    return null;
  }
}
function writeToken(t: CachedToken) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}
export function clearGoogleToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Scopes Google has granted so far (space separated). */
export const grantedScopes = () => readToken()?.scope ?? "";
export const hasFeature = (f: GoogleFeature) => grantedScopes().split(" ").includes(GOOGLE_SCOPES[f]);

/** Called right after Google sign-in with the tokens Supabase hands back. */
export async function rememberProviderTokens(accessToken: string, refreshToken?: string | null) {
  if (readToken()?.token === accessToken) return;
  let scope = "";
  try {
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`).then((r) => r.json());
    scope = info.scope ?? "";
  } catch {
    /* ignore */
  }
  writeToken({ token: accessToken, exp: Date.now() + 55 * 60 * 1000, scope });
  if (refreshToken && supabase) {
    await supabase.functions.invoke("google-token", { body: { action: "store", refresh_token: refreshToken } });
  }
}

/** A valid Google access token, refreshing through the edge function when needed. */
export async function getAccessToken(): Promise<string> {
  const cached = readToken();
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase.functions.invoke("google-token", { body: { action: "refresh" } });
  if (error) throw new Error(await functionError(error));
  writeToken({ token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000, scope: data.scope ?? cached?.scope ?? "" });
  return data.access_token;
}

/** Sign in with Google, asking for the given extra features (redirects away). */
export async function connectGoogle(features: GoogleFeature[]) {
  if (!supabase) throw new Error("Backend not configured");
  const wanted = new Set(["openid", "email", "profile", ...grantedScopes().split(" ").filter(Boolean)]);
  features.forEach((f) => wanted.add(GOOGLE_SCOPES[f]));
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      scopes: [...wanted].join(" "),
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  });
  if (error) throw error;
}

export async function revokeGoogle() {
  clearGoogleToken();
  if (supabase) await supabase.functions.invoke("google-token", { body: { action: "revoke" } });
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Google API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* ───────────── Google Calendar ───────────── */

const CAL = "https://www.googleapis.com/calendar/v3";
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface GEvent {
  id: string;
  summary?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

function fromGoogle(e: GEvent): CalEvent | null {
  const startRaw = e.start.dateTime ?? e.start.date;
  if (!startRaw) return null;
  const start = new Date(e.start.dateTime ?? `${e.start.date}T00:00:00`);
  const date = toISO(start);
  let endDate: string | undefined;
  if (e.start.date && e.end.date) {
    const last = addDays(e.end.date, -1); // Google all-day end is exclusive
    if (last > date) endDate = last;
  }
  const title = e.summary ?? "(no title)";
  return {
    id: `google-${e.id}`,
    title,
    date,
    endDate,
    time: e.start.dateTime ? start.toTimeString().slice(0, 5) : undefined,
    place: e.location,
    category: guessCategory(title, "social"),
    source: "google",
  };
}

/** Events from the user's primary Google Calendar in a date range. */
export async function listGoogleEvents(fromISO: string, toISODate: string): Promise<CalEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
    timeMin: new Date(`${fromISO}T00:00:00`).toISOString(),
    timeMax: new Date(`${toISODate}T23:59:59`).toISOString(),
  });
  const data = await gfetch<{ items: GEvent[] }>(`${CAL}/calendars/primary/events?${params}`);
  return data.items.map(fromGoogle).filter((e): e is CalEvent => e !== null);
}

/** Finds or creates the "Abroad" calendar the app writes into. */
export async function ensureAbroadCalendar(knownId?: string): Promise<string> {
  const list = await gfetch<{ items: { id: string; summary: string }[] }>(`${CAL}/users/me/calendarList?maxResults=250`);
  if (knownId && list.items.some((c) => c.id === knownId)) return knownId;
  const existing = list.items.find((c) => c.summary === "Abroad");
  if (existing) return existing.id;
  const created = await gfetch<{ id: string }>(`${CAL}/calendars`, {
    method: "POST",
    body: JSON.stringify({ summary: "Abroad", description: "Classes, deadlines, trips and meetups from the Abroad app", timeZone: tz() }),
  });
  return created.id;
}

/** Adds Abroad events that aren't in the Google "Abroad" calendar yet. Returns how many were added. */
export async function pushToGoogle(calendarId: string, events: CalEvent[]): Promise<number> {
  const base = `${CAL}/calendars/${encodeURIComponent(calendarId)}/events`;
  const existing = await gfetch<{ items: GEvent[] }>(`${base}?maxResults=2500&showDeleted=false`);
  const have = new Set(existing.items.map((e) => e.extendedProperties?.private?.abroadId).filter(Boolean));
  const missing = events.filter((e) => !have.has(e.id));

  for (const e of missing) {
    const body: Record<string, unknown> = {
      summary: e.title,
      location: e.place,
      extendedProperties: { private: { abroadId: e.id } },
    };
    if (e.time) {
      const start = new Date(`${e.date}T${e.time}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      body.start = { dateTime: start.toISOString(), timeZone: tz() };
      body.end = { dateTime: end.toISOString(), timeZone: tz() };
    } else {
      body.start = { date: e.date };
      body.end = { date: addDays(e.endDate ?? e.date, 1) };
    }
    await gfetch(base, { method: "POST", body: JSON.stringify(body) });
  }
  return missing.length;
}

/* ───────────── Gmail ───────────── */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

const orGroup = (words: string[]) => `{${words.map((w) => (w.includes(" ") ? `"${w}"` : w)).join(" ")}}`;

export function gmailQuery(folder: MailFolder, opts: { universityDomain?: string; immigration: string[]; housing: string[] }) {
  const recent = "newer_than:180d";
  if (folder === "university") {
    return opts.universityDomain
      ? `from:${opts.universityDomain} ${recent}`
      : `${orGroup(["semester", "enrollment", "exam", "lecture", "Erasmus", "international office"])} ${recent}`;
  }
  if (folder === "immigration") return `${orGroup(opts.immigration)} ${recent}`;
  return `${orGroup(opts.housing)} ${recent}`;
}

const decodeEntities = (s: string) => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
};

function whenLabel(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toTimeString().slice(0, 5);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Real messages from the user's Gmail matching a folder rule. */
export async function listMail(folder: MailFolder, query: string, max = 8): Promise<(Mail & { ts: number })[]> {
  const list = await gfetch<{ messages?: { id: string; threadId: string }[] }>(
    `${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`,
  );
  const ids = list.messages ?? [];
  const msgs = await Promise.all(
    ids.map((m) =>
      gfetch<{ id: string; threadId: string; snippet: string; internalDate: string; payload: { headers: { name: string; value: string }[] } }>(
        `${GMAIL}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      ),
    ),
  );
  return msgs.map((m) => {
    const h = (n: string) => m.payload.headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const from = h("From").replace(/<.*?>/, "").replace(/"/g, "").trim() || h("From");
    const ts = Number(m.internalDate);
    return {
      id: m.id,
      threadId: m.threadId,
      from,
      subject: h("Subject") || "(no subject)",
      preview: decodeEntities(m.snippet),
      when: whenLabel(ts),
      ts,
      folder,
    };
  });
}

export const gmailLink = (threadId: string) => `https://mail.google.com/mail/u/0/#all/${threadId}`;
