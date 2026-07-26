import { NextResponse } from "next/server";
import { UnfurlError, unfurl } from "@/lib/server/unfurl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A small in-memory bucket, enough to stop a paste-loop hammering a shop. */
const WINDOW_MS = 60_000;
const LIMIT = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 500) {
      for (const [id, value] of hits) if (value.resetAt < now) hits.delete(id);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "One moment — too many links at once." },
      { status: 429 },
    );
  }

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with a url" },
      { status: 400 },
    );
  }

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json(
      { error: "Paste a product link first" },
      { status: 400 },
    );
  }

  try {
    const result = await unfurl(url);
    return NextResponse.json(result, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch (error) {
    if (error instanceof UnfurlError) {
      return NextResponse.json(
        { error: error.message, hint: error.hint },
        { status: error.status },
      );
    }
    console.error("[unfurl] unexpected failure", error);
    return NextResponse.json(
      { error: "Something went wrong reading that page" },
      { status: 500 },
    );
  }
}
