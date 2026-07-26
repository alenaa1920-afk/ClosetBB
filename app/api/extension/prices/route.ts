import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import { STORES, type StoreKey } from "@/lib/domain/stores";
import { isAvailability } from "@/lib/domain/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 40;

/** Houses the server cannot read, so the extension checks them instead. */
const BROWSER_ONLY: StoreKey[] = (Object.keys(STORES) as StoreKey[]).filter(
  (key) => STORES[key].serverFetch !== "open",
);

function client(token: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

/**
 * The pieces the extension should re-check, oldest first.
 *
 * Only the houses that refuse a server fetch — everything else is handled by
 * the cron, and there is no reason to spend her bandwidth on it.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const token = bearer(request);
  if (!token) {
    return NextResponse.json(
      { error: "Sign in to Mon Amour first" },
      { status: 401 },
    );
  }

  const supabase = client(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "That session has expired" },
      { status: 401 },
    );
  }

  const limit = Math.min(
    Number(new URL(request.url).searchParams.get("limit") ?? 10) || 10,
    MAX_ITEMS,
  );

  const { data, error } = await supabase
    .from("products")
    .select("id, title, product_url, price, store")
    .eq("user_id", user.id)
    .eq("tracking", true)
    .not("product_url", "is", null)
    .in("store", BROWSER_ONLY)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[prices] could not list", error);
    return NextResponse.json({ error: "Could not list pieces" }, { status: 500 });
  }

  return NextResponse.json({
    products: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      productUrl: row.product_url,
      store: row.store,
      price: row.price == null ? null : Number(row.price),
    })),
  });
}

interface Observation {
  id?: unknown;
  price?: unknown;
  availability?: unknown;
}

/**
 * Prices the extension read from inside her browser. The database trigger turns
 * any change into a price_history row, which is what the drop badge reads.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const token = bearer(request);
  if (!token) {
    return NextResponse.json(
      { error: "Sign in to Mon Amour first" },
      { status: 401 },
    );
  }

  const supabase = client(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "That session has expired" },
      { status: 401 },
    );
  }

  let payload: { observations?: unknown };
  try {
    payload = (await request.json()) as { observations?: unknown };
  } catch {
    return NextResponse.json({ error: "Send a JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(payload.observations) ? payload.observations : [];
  if (!incoming.length) {
    return NextResponse.json({ error: "Nothing to record" }, { status: 400 });
  }
  if (incoming.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Too many at once" }, { status: 413 });
  }

  const now = new Date().toISOString();
  let updated = 0;
  let drops = 0;

  for (const entry of incoming as Observation[]) {
    if (typeof entry?.id !== "string") continue;

    const parsed =
      typeof entry.price === "number" ? entry.price : Number(entry.price);
    const price =
      Number.isFinite(parsed) && parsed > 0 && parsed < 100_000_000
        ? Math.round(parsed * 100) / 100
        : null;

    const patch: Database["public"]["Tables"]["products"]["Update"] = {
      last_checked_at: now,
    };
    if (price != null) patch.price = price;
    if (isAvailability(entry.availability)) patch.availability = entry.availability;

    // Read the old figure first so we can report what moved.
    const { data: before } = await supabase
      .from("products")
      .select("price")
      .eq("id", entry.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", entry.id)
      // Belt and braces alongside row-level security.
      .eq("user_id", user.id);

    if (error) continue;

    updated += 1;
    const was = before?.price == null ? null : Number(before.price);
    if (was != null && price != null && price < was) drops += 1;
  }

  return NextResponse.json({ updated, drops });
}
