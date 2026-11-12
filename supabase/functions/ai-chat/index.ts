// AI Companion ‚Äî chats with Google Gemini about life in the student's host city.
// Secret needed: GEMINI_API_KEY  (Supabase ‚Üí Edge Functions ‚Üí Secrets)
// Optional secret: GEMINI_MODEL (default "gemini-flash-latest" = Google's newest Flash model)
// Self-contained single file so it can be pasted into the Supabase dashboard editor.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
const BACKUP_MODEL = "gemini-2.5-flash"; // tried if the model above is not found
const DAILY_LIMIT = 30; // user messages per user per day
const HISTORY = 20; // past messages sent to the AI

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are the AI Companion inside "Abroad", an app for exchange students.
You help one student with everyday life in their host city: residence registration, visas and permits,
banking, health insurance, housing, transport, university admin, budgeting, culture and making friends.

Style:
- Warm, practical and concise. Lead with the answer, then short steps or bullets when useful.
- Answer in the language the student writes in.
- Use the student context below (city, university, dates, checklist progress, upcoming events) to make answers specific.
- Rules, fees and office procedures change. When something depends on official rules, say what is usually true,
  and point to the official source (city office, embassy, university international office) to confirm.
- If you are not sure, say so instead of guessing. For emergencies, give the local emergency number (112 in the EU) first.`;

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // who is calling?
  // (validated with Supabase Auth, so it works with both legacy and new JWT signing keys)
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth } = await db.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "AI is not set up yet (missing GEMINI_API_KEY secret)" }, 500);

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 6000) : "";
  if (!message) return json({ error: "Empty message" }, 400);

  // daily rate limit
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await db
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", since.toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Daily limit reached (${DAILY_LIMIT} messages). Try again tomorrow.` }, 429);

  // recent history (oldest first)
  const { data: past } = await db
    .from("ai_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY);
  const history: Msg[] = (past ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));
  // the conversation must start with a user turn
  while (history.length && history[0].role !== "user") history.shift();
  // and to alternate ‚Äî drop a dangling user turn (e.g. a past request that failed)
  if (history.length && history[history.length - 1].role === "user") history.pop();

  const { error: saveErr } = await db.from("ai_messages").insert({ user_id: user.id, role: "user", content: message });
  if (saveErr) return json({ error: saveErr.message }, 500);

  const request = {
    systemInstruction: { parts: [{ text: context ? `${SYSTEM}\n\n<student_context>\n${context}\n</student_context>` : SYSTEM }] },
    contents: [...history, { role: "user", content: message }].map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  };

  try {
    let res = await callGemini(MODEL, apiKey, request);
    if (res.status === 404 && MODEL !== BACKUP_MODEL) res = await callGemini(BACKUP_MODEL, apiKey, request);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429) return json({ error: "The AI is busy or out of quota. Please try again in a minute." }, 429);
      if (res.status === 400 && /api key/i.test(msg)) return json({ error: "GEMINI_API_KEY is invalid" }, 500);
      if (res.status === 403) return json({ error: `Gemini refused the key: ${msg}` }, 500);
      return json({ error: `AI error (${res.status}): ${msg}` }, 502);
    }

    const cand = data?.candidates?.[0];
    if (data?.promptFeedback?.blockReason || cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") {
      const reply = "Sorry ‚Äî I can't help with that one. Try asking in a different way, or ask me something else about life abroad.";
      return json({ reply, refused: true });
    }

    const reply = (cand?.content?.parts ?? [])
      .filter((p: { text?: string; thought?: boolean }) => typeof p.text === "string" && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("")
      .trim();
    if (!reply) return json({ error: "Empty answer, please try again" }, 502);

    await db.from("ai_messages").insert({ user_id: user.id, role: "assistant", content: reply });
    return json({ reply });
  } catch (e) {
    return json({ error: `AI error: ${(e as Error).message}` }, 500);
  }
});

function callGemini(model: string, apiKey: string, body: unknown) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}
