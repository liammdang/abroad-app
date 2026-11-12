// AI Companion — chats with Google Gemini about life in the student's host city.
// Secret needed: GEMINI_API_KEY  (Supabase → Edge Functions → Secrets)
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
  if (body.action === "personalize") return personalize(body.profile ?? {}, apiKey);
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
  // and to alternate — drop a dangling user turn (e.g. a past request that failed)
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
      const reply = "Sorry — I can't help with that one. Try asking in a different way, or ask me something else about life abroad.";
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

function callGemini(model: string, apiKey: string, body: unknown, timeoutMs = 60_000) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/* ───────────── Onboarding: build a personal "city pack" ───────────── */

const S = (description?: string) => ({ type: "STRING", ...(description ? { description } : {}) });
const LIST = (items: unknown, description?: string) => ({ type: "ARRAY", items, ...(description ? { description } : {}) });
const OBJ = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "OBJECT", properties, required });
const CATEGORY = { type: "STRING", enum: ["class", "exam", "assignment", "admin", "travel", "social"] };
const TASK = OBJ({
  title: S("short action, e.g. 'Register your address (Anmeldung)'"),
  summary: S("1–2 sentences: what and why"),
  documents: LIST(S(), "documents to bring"),
  tip: S("one insider tip"),
  mapsQuery: S("name of the office/place to search on Google Maps, or empty"),
});

const PACK_SCHEMA = OBJ({
  city: S("canonical English city name"),
  country: S("country in English"),
  flag: S("country flag emoji"),
  greeting: S("'hello' in the local language"),
  summary: S("2–3 sentences addressed to the student about what matters most for them"),
  universityDomain: S("the university's email domain, e.g. 'uni-koeln.de', or empty if unsure"),
  phases: OBJ({
    pre: LIST(TASK, "before departure, 4–6 tasks"),
    first14: LIST(TASK, "first 14 days, 4–6 tasks"),
    month: LIST(TASK, "first month, 3–5 tasks"),
    departure: LIST(TASK, "before leaving, 3–4 tasks"),
  }),
  spots: LIST(
    OBJ({
      name: S("real, well-known place"),
      category: { type: "STRING", enum: ["study", "eats", "culture", "nightlife"] },
      description: S("one short line"),
      area: S("neighbourhood"),
      price: S("e.g. '€', '€€', 'Free', 'Student €5'"),
      rating: { type: "NUMBER" },
    }),
    "8–10 places that match the student's interests",
  ),
  apps: LIST(
    OBJ({
      name: S("exact app name in the app stores"),
      category: { type: "STRING", enum: ["transport", "money", "housing", "food", "health", "everyday"] },
      why: S("one line"),
      essential: { type: "BOOLEAN" },
    }),
    "10–14 apps to download for this city and country",
  ),
  keyDates: LIST(
    OBJ({ title: S(), date: S("YYYY-MM-DD"), category: CATEGORY }),
    "6–10 important dates and deadlines during the stay",
  ),
  mailRules: OBJ({
    immigration: LIST(S(), "6–10 email keywords (local language + English) for visa / residence / city-office mail"),
    housing: LIST(S(), "6–10 email keywords for rent / landlord / utilities mail"),
  }),
  ai: OBJ({ question: S("a typical first question this student would ask"), answer: S("short helpful answer, max 2 sentences") }),
});

async function personalize(p: Record<string, unknown>, apiKey: string) {
  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
  const interests = Array.isArray(p.interests) ? p.interests.map((x) => str(x, 60)).slice(0, 30) : [];
  const city = str(p.city, 80);
  if (!city) return json({ error: "Missing city" }, 400);

  const prompt = `Build a personal relocation plan for this student.

Student:
- Name: ${str(p.name, 60)}
- Nationality / home country: ${str(p.homeCountry, 80) || "not given"}
- Moving to: ${city}${str(p.country, 80) ? `, ${str(p.country, 80)}` : ""}
- University: ${str(p.university, 160)}
- Program: ${str(p.program, 60) || "exchange"}
- Arrival: ${str(p.start, 10)}  Departure: ${str(p.end, 10)}
- Interests: ${interests.join(", ") || "none given"}
- Notes from the student: ${str(p.about, 600) || "none"}
- Today: ${str(p.today, 10)}

Rules:
- Paperwork must fit THIS nationality going to THIS country (e.g. EU citizens need no visa in the EU; others usually need a national visa and a residence permit). Use the local names of offices and documents with an English explanation.
- Include university-specific steps (enrolment, student ID, semester ticket) for this university when you know them.
- Spots and apps must be real and currently popular. Prefer places that match the interests. Do not invent places.
- keyDates must be real dates between arrival and departure, computed from the arrival date (e.g. address registration within 14 days of arrival, residence permit before the visa expires, semester start/end if known). Use category "admin" for paperwork, "exam" or "assignment" for academic deadlines, "travel" for trips, "social" for orientation events.
- Write in clear, friendly English. Keep every text field short.`;

  const request = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: PACK_SCHEMA, maxOutputTokens: 24000, temperature: 0.4 },
  };
  try {
    let res = await callGemini(MODEL, apiKey, request, 120_000);
    if (res.status === 404 && MODEL !== BACKUP_MODEL) res = await callGemini(BACKUP_MODEL, apiKey, request, 120_000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: `AI error (${res.status}): ${data?.error?.message ?? "request failed"}` }, res.status === 429 ? 429 : 502);
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((x: { text?: string; thought?: boolean }) => typeof x.text === "string" && !x.thought)
      .map((x: { text: string }) => x.text)
      .join("")
      .replace(/^```(?:json)?\s*|\s*```$/g, "");
    try {
      return json({ pack: JSON.parse(text) });
    } catch {
      return json({ error: "The AI answer was incomplete, please try again" }, 502);
    }
  } catch (e) {
    return json({ error: `AI error: ${(e as Error).message}` }, 500);
  }
}
