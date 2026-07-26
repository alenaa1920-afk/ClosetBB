import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CRON_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isTrackerConfigured,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import { STORES, type StoreKey } from "@/lib/domain/stores";
import { probePrice } from "@/lib/server/unfurl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Comfortably inside Vercel's limit while leaving room for slow shops. */
export const maxDuration = 60;

/**
 * The ceiling on one run. The real limiter is the time budget below — on
 * Vercel's free plan this runs once a day, so it should get through as much as
 * it safely can rather than stopping at an arbitrary count.
 */
const BATCH = 60;

/**
 * Stop with room to spare inside `maxDuration`, so the run always finishes
 * tidily and records what it did instead of being killed mid-flight.
 */
const TIME_BUDGET_MS = 45_000;

/**
 * Houses that answer a plain server fetch. The rest are re-checked by the
 * extension from inside her browser instead — see /api/extension/prices.
 */
const TRACKABLE: StoreKey[] = (Object.keys(STORES) as StoreKey[]).filter(
  (key) => STORES[key].serverFetch === "open",
);

/**
 * The price tracker. Vercel Cron calls this; it walks the pieces whose price
 * has gone longest unchecked, re-reads each one, and lets the database trigger
 * append to price_history whenever the figure has moved.
 *
 * There is no such thing as instant price tracking — no shop pushes us a
 * notification. This is a scheduled re-read, which is what every price watcher
 * actually does underneath.
 */
export async function GET(request: Request) {
  if (!isTrackerConfigured()) {
    return NextResponse.json(
      { error: "The tracker needs SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  if (CRON_SECRET) {
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Not for you" }, { status: 401 });
    }
  }

  // Service role: the tracker is the one thing that must see every wardrobe.
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: due, error } = await supabase
    .from("products")
    .select("id, product_url, price, store")
    .eq("tracking", true)
    .not("product_url", "is", null)
    .in("store", TRACKABLE)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (error) {
    console.error("[track] could not list pieces", error);
    return NextResponse.json({ error: "Could not list pieces" }, { status: 500 });
  }

  const checked: Array<{
    id: string;
    was: number | null;
    now: number | null;
    dropped: boolean;
  }> = [];
  const failures: Array<{ id: string; reason: string }> = [];
  const startedAt = Date.now();
  let ranOutOfTime = false;

  for (const row of due ?? []) {
    if (!row.product_url) continue;

    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      // Whatever is left keeps its old `last_checked_at`, so it sits at the
      // front of the queue tomorrow. Nothing is ever skipped permanently.
      ranOutOfTime = true;
      break;
    }

    try {
      const observed = await probePrice(row.product_url);
      const was = row.price == null ? null : Number(row.price);
      const now = observed.price;

      // Always stamp the check, so a shop we cannot read does not block the
      // queue by staying permanently "oldest".
      const patch: Database["public"]["Tables"]["products"]["Update"] = {
        last_checked_at: new Date().toISOString(),
      };
      if (now != null) patch.price = now;
      if (observed.originalPrice != null) {
        patch.original_price = observed.originalPrice;
      }
      if (observed.availability) patch.availability = observed.availability;

      const { error: updateError } = await supabase
        .from("products")
        .update(patch)
        .eq("id", row.id);

      if (updateError) {
        failures.push({ id: row.id, reason: updateError.message });
        continue;
      }

      checked.push({
        id: row.id,
        was,
        now,
        dropped: was != null && now != null && now < was,
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "unknown";
      failures.push({ id: row.id, reason });
      // Still stamp it, so one stubborn piece cannot stall every other.
      await supabase
        .from("products")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    considered: due?.length ?? 0,
    checked: checked.length,
    drops: checked.filter((entry) => entry.dropped).length,
    failures: failures.length,
    // True when there were more pieces than the run had time for; they go
    // first tomorrow.
    ranOutOfTime,
    elapsedMs: Date.now() - startedAt,
    trackableStores: TRACKABLE.filter((key) => key !== "other"),
  });
}

/** Convenience for a manual run: same work, same guard. */
export async function POST(request: Request) {
  return GET(request);
}
