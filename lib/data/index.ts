import { supabaseBrowser } from "@/lib/supabase/client";
import { LocalRepository } from "./local-repository";
import { SupabaseRepository } from "./supabase-repository";
import type { WardrobeRepository } from "./repository";

export type RepositoryResolution =
  | { ok: true; repository: WardrobeRepository }
  | { ok: false; reason: "signed-out" };

/**
 * Picks the adapter for this browser: Supabase when keys and a session exist,
 * otherwise the local atelier.
 */
export async function resolveRepository(): Promise<RepositoryResolution> {
  const client = supabaseBrowser();
  if (!client) return { ok: true, repository: new LocalRepository() };

  const {
    data: { user },
  } = await client.auth.getUser();

  // Configured but signed out: middleware is already redirecting to /login.
  if (!user) return { ok: false, reason: "signed-out" };

  return { ok: true, repository: new SupabaseRepository(client, user.id) };
}

export { LocalRepository } from "./local-repository";
export { SupabaseRepository } from "./supabase-repository";
export * from "./repository";
