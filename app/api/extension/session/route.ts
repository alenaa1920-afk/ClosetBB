import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands the Chrome extension the current access token, authenticated by the
 * ordinary session cookie.
 *
 * Safe cross-origin because no CORS headers are sent: a hostile page can make
 * the request but cannot read the reply. The extension can, because its host
 * permission exempts it from CORS. Nothing here mutates state.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "This Mon Amour has no Supabase configured" },
      { status: 503 },
    );
  }

  const supabase = await supabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Confirm the token against the auth server rather than trusting the cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json(
    {
      accessToken: session.access_token,
      // Lets the extension mint its own access tokens from then on, so it keeps
      // working when no Mon Amour tab is open. Only ever returned to an
      // authenticated same-origin caller, and CORS stops any other site reading
      // the reply.
      refreshToken: session.refresh_token ?? null,
      expiresAt: session.expires_at ?? null,
      email: user.email ?? null,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
