import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  SESSION_COOKIE_MAX_AGE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./env";
import type { Database } from "./database.types";

/**
 * Server client for route handlers, server components and server actions.
 * Returns null when the project has no keys, so callers can fall back to the
 * local atelier instead of throwing.
 */
export async function supabaseServer() {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a server component — the middleware refreshes instead.
        }
      },
    },
  });
}

/** The signed-in person, or null. */
export async function currentUser() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
