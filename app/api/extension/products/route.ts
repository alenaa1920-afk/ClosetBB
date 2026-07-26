import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import { categorise, isCategoryKey } from "@/lib/domain/categories";
import { isStoreKey, storeFromUrl } from "@/lib/domain/stores";
import { isAvailability } from "@/lib/domain/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 60;

interface IncomingProduct {
  title?: unknown;
  brand?: unknown;
  store?: unknown;
  category?: unknown;
  price?: unknown;
  originalPrice?: unknown;
  currency?: unknown;
  discount?: unknown;
  imageUrl?: unknown;
  productUrl?: unknown;
  size?: unknown;
  sizesAvailable?: unknown;
  color?: unknown;
  quantity?: unknown;
  seller?: unknown;
  rating?: unknown;
  ratingCount?: unknown;
  sku?: unknown;
  availability?: unknown;
}

function text(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/** Bounded whole number, or null. */
function count(value: unknown, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Math.round(parsed), max);
}

function stringList(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    const item = text(entry, 24);
    if (item) seen.add(item);
    if (seen.size >= max) break;
  }
  return [...seen];
}

function money(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) return null;
  return Math.round(parsed * 100) / 100;
}

function httpsUrl(value: unknown): string | null {
  const raw = text(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * The Chrome extension posts here with the signed-in person's Supabase access
 * token. The token is what authorises the write — row-level security still
 * applies, so the extension can only ever touch its own wardrobe.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "This Mon Amour is running without Supabase, so the extension has nowhere to save.",
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json(
      { error: "Sign in to Mon Amour first" },
      { status: 401 },
    );
  }

  // Acts as the token holder, so every insert passes through RLS.
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

  let payload: { products?: unknown };
  try {
    payload = (await request.json()) as { products?: unknown };
  } catch {
    return NextResponse.json({ error: "Send a JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(payload.products) ? payload.products : [];
  if (!incoming.length) {
    return NextResponse.json(
      { error: "No products in that payload" },
      { status: 400 },
    );
  }
  if (incoming.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `That is more than ${MAX_ITEMS} pieces at once` },
      { status: 413 },
    );
  }

  const rows = incoming
    .filter(
      (entry): entry is IncomingProduct =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => {
      const title = text(entry.title, 300);
      if (!title) return null;

      const productUrl = httpsUrl(entry.productUrl);
      const storeCandidate = text(entry.store, 40);
      const store =
        storeCandidate && isStoreKey(storeCandidate)
          ? storeCandidate
          : productUrl
            ? storeFromUrl(productUrl)
            : "other";

      const categoryCandidate = text(entry.category, 40);
      const category =
        categoryCandidate && isCategoryKey(categoryCandidate)
          ? categoryCandidate
          : categorise(title, text(entry.brand, 120), categoryCandidate);

      const price = money(entry.price);
      const originalPrice = money(entry.originalPrice);

      return {
        user_id: user.id,
        title,
        brand: text(entry.brand, 120),
        store,
        category,
        price,
        original_price:
          originalPrice != null && price != null && originalPrice > price
            ? originalPrice
            : null,
        currency: (text(entry.currency, 8) ?? "INR").toUpperCase(),
        discount:
          typeof entry.discount === "number" && Number.isFinite(entry.discount)
            ? Math.max(0, Math.min(99, Math.round(entry.discount)))
            : null,
        image_url: httpsUrl(entry.imageUrl),
        product_url: productUrl,
        size: text(entry.size, 40),
        sizes_available: stringList(entry.sizesAvailable),
        color: text(entry.color, 60),
        quantity: count(entry.quantity, 99),
        seller: text(entry.seller, 120),
        rating: (() => {
          const parsed =
            typeof entry.rating === "number" ? entry.rating : Number(entry.rating);
          if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) return null;
          return Math.round(parsed * 100) / 100;
        })(),
        rating_count: count(entry.ratingCount, 100_000_000),
        sku: text(entry.sku, 80),
        availability: isAvailability(entry.availability)
          ? entry.availability
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) {
    return NextResponse.json(
      { error: "None of those pieces had a title" },
      { status: 422 },
    );
  }

  // Rows without a link cannot be de-duplicated, so they are inserted plainly.
  const withUrl = rows.filter((row) => row.product_url !== null);
  const withoutUrl = rows.filter((row) => row.product_url === null);
  let saved = 0;

  if (withUrl.length) {
    const { data, error } = await supabase
      .from("products")
      .upsert(withUrl, { onConflict: "user_id,product_url" })
      .select("id");
    if (error) {
      console.error("[extension] upsert failed", error);
      return NextResponse.json(
        { error: "Could not save those pieces" },
        { status: 500 },
      );
    }
    saved += data?.length ?? 0;
  }

  if (withoutUrl.length) {
    const { data, error } = await supabase
      .from("products")
      .insert(withoutUrl)
      .select("id");
    if (error) {
      console.error("[extension] insert failed", error);
      return NextResponse.json(
        { error: "Could not save those pieces" },
        { status: 500 },
      );
    }
    saved += data?.length ?? 0;
  }

  return NextResponse.json({ saved, received: incoming.length });
}

/** Lets the extension check whether it is signed in and pointed at the right app. */
export async function GET() {
  return NextResponse.json({
    app: "mon-amour",
    supabase: isSupabaseConfigured(),
  });
}
