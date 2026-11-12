// Fetches a university iCal (.ics) feed on behalf of the browser
// (browsers can't fetch most feeds directly because of CORS).
// Self-contained single file so it can be pasted into the Supabase dashboard editor.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Returns the signed-in user for this request, or null. */
// Asks Supabase Auth to validate the token, so it works with both legacy and new JWT signing keys.
async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

const MAX_BYTES = 3_000_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const user = await getUser(req);
  if (!user) return json({ error: "Not signed in" }, 401);

  const { url } = await req.json().catch(() => ({}));
  let target: URL;
  try {
    target = new URL(String(url).replace(/^webcal:/i, "https:"));
  } catch {
    return json({ error: "Invalid URL" }, 400);
  }
  if (!["http:", "https:"].includes(target.protocol) || PRIVATE_HOST.test(target.hostname)) {
    return json({ error: "URL not allowed" }, 400);
  }

  try {
    const res = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return json({ error: `Feed returned ${res.status}` }, 502);
    const text = await res.text();
    if (text.length > MAX_BYTES) return json({ error: "Feed too large" }, 413);
    if (!text.includes("BEGIN:VCALENDAR")) return json({ error: "That link is not an iCal feed" }, 422);
    return json({ ics: text });
  } catch (e) {
    return json({ error: `Could not fetch feed: ${(e as Error).message}` }, 502);
  }
});
