"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  SESSION_COOKIE_MAX_AGE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./env";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client, memoised so auth state is shared across the app. */
export function supabaseBrowser() {
  if (!isSupabaseConfigured()) return null;
  cached ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // Survive closing the laptop, closing Chrome, and a fortnight away.
    cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE },
  });
  return cached;
}
