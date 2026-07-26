/**
 * Mon Amour runs in one of two modes:
 *
 *  · Supabase — the real thing, with auth, Postgres and storage.
 *  · Atelier  — a local demo when no keys are present, so the wardrobe still
 *               opens and looks like itself on a fresh clone.
 *
 * Both read from the same repository interface, so nothing above this layer
 * needs to know which one is live.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Server-only. Lets the price tracker walk every wardrobe on a schedule,
 * which row-level security would otherwise (correctly) prevent. Never expose
 * this to the browser.
 */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Shared secret Vercel Cron presents when it calls the tracker. */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

export function isTrackerConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/** Bucket that holds mirrored product imagery. */
export const IMAGE_BUCKET = "product-images";

/**
 * Keep her signed in.
 *
 * 400 days is the longest a browser will honour (Chrome caps cookie lifetime
 * there). Supabase rotates the refresh token on every visit, so in practice the
 * clock keeps resetting and she simply never sees a login screen again.
 */
export const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
