import type { EssentialApp } from "@/data/apps";
import type { CalEvent, City, CityPack, EventCategory, KeyDate, Phase, PhaseId, Spot, SpotCategory, Task } from "@/data/types";
import { functionError, supabase } from "./supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ContextInput {
  today: string;
  city: City;
  profile: { name: string; university: string; start: string; end: string; interests: string[]; homeCountry?: string; program?: string; about?: string };
  isDone: (id: string) => boolean;
  events: CalEvent[];
}

/** A compact summary of the student's situation, sent with each question so answers are specific. */
export function buildContext({ today, city, profile, isDone, events }: ContextInput): string {
  const lines = [
    `Today: ${today}`,
    `Student: ${profile.name}, studying at ${profile.university} in ${city.name}, ${city.country}`,
    `Stay: ${profile.start} to ${profile.end}`,
    profile.homeCountry ? `Nationality / home country: ${profile.homeCountry}` : "",
    profile.program ? `Program: ${profile.program}` : "",
    profile.interests.length ? `Interests: ${profile.interests.join(", ")}` : "",
    profile.about ? `Notes from the student: ${profile.about}` : "",
    "",
    "Life Admin checklist:",
    ...city.phases.map((p) => {
      const open = p.items.filter((t) => !isDone(t.id)).map((t) => t.title);
      const done = p.items.length - open.length;
      return `- ${p.label}: ${done}/${p.items.length} done${open.length ? `; still to do: ${open.join("; ")}` : ""}`;
    }),
  ];
  const upcoming = events
    .filter((e) => e.date >= today && e.source !== "stay")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  if (upcoming.length) {
    lines.push("", "Upcoming calendar:");
    for (const e of upcoming) lines.push(`- ${e.date}${e.time ? ` ${e.time}` : ""}: ${e.title} (${e.category})${e.place ? ` @ ${e.place}` : ""}`);
  }
  return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export async function loadHistory(): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({ id: String(m.id), role: m.role, content: m.content }));
}

export async function clearHistory(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase.from("ai_messages").delete().eq("user_id", data.user.id);
  if (error) throw new Error(error.message);
}

export async function askAi(message: string, context: string): Promise<string> {
  if (!supabase) throw new Error("No backend connected");
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: { message, context } });
  if (error) throw new Error(await functionError(error));
  if (data?.error) throw new Error(data.error);
  return String(data.reply ?? "");
}

/* ───────────── Onboarding personalization ───────────── */

export interface PersonalizeInput {
  name: string;
  city: string;
  country?: string;
  university: string;
  start: string;
  end: string;
  interests: string[];
  homeCountry?: string;
  program?: string;
  about?: string;
  today: string;
}

const PHASES: { id: PhaseId; label: string }[] = [
  { id: "pre", label: "Pre-Departure" },
  { id: "first14", label: "First 14 Days" },
  { id: "month", label: "First Month" },
  { id: "departure", label: "Departure" },
];
const SPOT_CATS: SpotCategory[] = ["study", "eats", "culture", "nightlife"];
const APP_CATS = ["transport", "money", "housing", "food", "health", "everyday"] as const;
const EVENT_CATS: EventCategory[] = ["class", "exam", "assignment", "admin", "travel", "social"];

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => str(x)).filter(Boolean);

/** Make whatever the AI returned safe to render (ids, enums, dates). */
export function normalizePack(raw: unknown, input: PersonalizeInput): CityPack {
  const r = (raw ?? {}) as Record<string, unknown>;
  const phasesRaw = (r.phases ?? {}) as Record<string, unknown>;
  const phases: Phase[] = PHASES.map(({ id, label }) => ({
    id,
    label,
    items: arr(phasesRaw[id])
      .map((t, i): Task | null => {
        const o = (t ?? {}) as Record<string, unknown>;
        const title = str(o.title);
        if (!title) return null;
        return {
          id: `ai-${id}-${i}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
          title,
          summary: str(o.summary),
          documents: strs(o.documents),
          tip: str(o.tip),
          samples: [],
          mapsQuery: str(o.mapsQuery) || undefined,
        };
      })
      .filter((t): t is Task => t !== null),
  }));
  const spots: Spot[] = arr(r.spots)
    .map((x, i) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const cat = str(o.category) as SpotCategory;
      const rating = Number(o.rating);
      return {
        id: `ai-spot-${i}`,
        name: str(o.name),
        category: SPOT_CATS.includes(cat) ? cat : "culture",
        description: str(o.description),
        area: str(o.area),
        price: str(o.price),
        rating: Number.isFinite(rating) ? Math.min(5, Math.max(3, Math.round(rating * 10) / 10)) : 4.5,
      };
    })
    .filter((s) => s.name);
  const apps: EssentialApp[] = arr(r.apps)
    .map((x, i) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const cat = str(o.category) as (typeof APP_CATS)[number];
      return {
        id: `ai-app-${str(o.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || i}`,
        name: str(o.name),
        category: APP_CATS.includes(cat) ? cat : "everyday",
        why: str(o.why),
        essential: o.essential === true,
      };
    })
    .filter((a) => a.name);
  const keyDates: KeyDate[] = arr(r.keyDates)
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const cat = str(o.category) as EventCategory;
      return { title: str(o.title), date: str(o.date).slice(0, 10), category: EVENT_CATS.includes(cat) ? cat : "admin" };
    })
    .filter((k) => k.title && /^\d{4}-\d{2}-\d{2}$/.test(k.date));
  const mail = (r.mailRules ?? {}) as Record<string, unknown>;
  const ai = (r.ai ?? {}) as Record<string, unknown>;
  const city = str(r.city) || input.city;
  return {
    city,
    country: str(r.country) || input.country || "",
    flag: str(r.flag),
    greeting: str(r.greeting) || "Hello",
    summary: str(r.summary),
    universityDomain: str(r.universityDomain).replace(/^@/, "") || undefined,
    phases,
    spots,
    apps,
    keyDates,
    mailRules: {
      immigration: strs(mail.immigration).length ? strs(mail.immigration) : ["visa", "residence permit", "immigration"],
      housing: strs(mail.housing).length ? strs(mail.housing) : ["rent", "deposit", "landlord"],
    },
    ai: { question: str(ai.question) || `What should I do first in ${city}?`, answer: str(ai.answer) || "Ask me anything about your move." },
    generatedAt: new Date().toISOString(),
  };
}

/** Ask Gemini (through the ai-chat edge function) for this student's plan. Takes ~20–60 s. */
export async function generatePack(input: PersonalizeInput): Promise<CityPack> {
  if (!supabase) throw new Error("No backend connected");
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: { action: "personalize", profile: input } });
  if (error) throw new Error(await functionError(error));
  if (data?.error) throw new Error(data.error);
  const pack = normalizePack(data?.pack, input);
  if (pack.phases.every((p) => p.items.length === 0)) throw new Error("The AI plan came back empty, please try again");
  return pack;
}
