// Stores the user's Google refresh token server-side and hands out fresh
// access tokens, so Calendar/Gmail keep working after the first hour.
// Secrets needed: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
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
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const user = await getUser(req);
  if (!user) return json({ error: "Not signed in" }, 401);

  const { action, refresh_token } = await req.json().catch(() => ({}));
  const db = admin();

  if (action === "store") {
    if (typeof refresh_token !== "string" || refresh_token.length < 10) return json({ error: "Missing refresh_token" }, 400);
    const { error } = await db
      .from("google_tokens")
      .upsert({ user_id: user.id, refresh_token, updated_at: new Date().toISOString() });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (action === "refresh") {
    const { data } = await db.from("google_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
    if (!data) return json({ error: "No Google connection — please sign in with Google again" }, 404);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const body = await res.json();
    if (!res.ok) return json({ error: body.error_description ?? body.error ?? "Google refresh failed" }, 400);
    return json({ access_token: body.access_token, expires_in: body.expires_in, scope: body.scope });
  }

  if (action === "revoke") {
    const { data } = await db.from("google_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
    if (data) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: "POST" });
      await db.from("google_tokens").delete().eq("user_id", user.id);
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
