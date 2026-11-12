import type { CalEvent, City } from "@/data/types";
import { functionError, supabase } from "./supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ContextInput {
  today: string;
  city: City;
  profile: { name: string; university: string; start: string; end: string; interests: string[] };
  isDone: (id: string) => boolean;
  events: CalEvent[];
}

/** A compact summary of the student's situation, sent with each question so answers are specific. */
export function buildContext({ today, city, profile, isDone, events }: ContextInput): string {
  const lines = [
    `Today: ${today}`,
    `Student: ${profile.name}, studying at ${profile.university} in ${city.name}, ${city.country}`,
    `Stay: ${profile.start} to ${profile.end}`,
    profile.interests.length ? `Interests: ${profile.interests.join(", ")}` : "",
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
