import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { categorise } from "@/lib/domain/categories";
import { extensionHint, getStore, storeFromUrl } from "@/lib/domain/stores";
import type { Unfurled } from "@/lib/domain/unfurl";

const TIMEOUT_MS = 9000;
const MAX_BYTES = 2_000_000;

/** A real browser string: several boutiques refuse anything else. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export class UnfurlError extends Error {
  /** Store-specific guidance, filled in once we know which shop it was. */
  hint?: string;

  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UnfurlError";
  }
}

/* ------------------------------------------------------------------ *
 *  Guards — this endpoint fetches a URL the client chose, so it must
 *  never be usable as a probe into the private network.
 * ------------------------------------------------------------------ */

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return true;
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/**
 * Expands any IPv6 spelling into its eight 16-bit groups.
 *
 * Needed because `URL` re-spells addresses: `::ffff:10.0.0.1` comes back as
 * `::ffff:a00:1`, so a dotted-quad regex would miss a private target.
 */
function expandIPv6(input: string): number[] | null {
  let text = input.split("%")[0].toLowerCase();
  let trailing: number[] = [];

  // A trailing dotted-quad contributes the final two groups.
  const embedded = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(text);
  if (embedded) {
    const octets = embedded[1].split(".").map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    trailing = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    text = text.slice(0, text.length - embedded[1].length);
    if (text.endsWith(":") && !text.endsWith("::")) text = text.slice(0, -1);
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const piece of part.split(":")) {
      if (piece === "") continue;
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      out.push(Number.parseInt(piece, 16));
    }
    return out;
  };

  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (head === null || tail === null) return null;

  const counted = head.length + tail.length + trailing.length;
  if (halves.length === 2) {
    const fill = 8 - counted;
    if (fill < 0) return null;
    return [...head, ...new Array<number>(fill).fill(0), ...tail, ...trailing];
  }
  if (counted !== 8) return null;
  return [...head, ...trailing];
}

function isPrivateIPv6(address: string): boolean {
  const groups = expandIPv6(address);
  // Anything we cannot read is refused rather than guessed at.
  if (!groups) return true;

  const embeddedV4 = () =>
    isPrivateIPv4(
      [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(
        ".",
      ),
    );

  const leadingZeros = groups.slice(0, 5).every((group) => group === 0);

  // :: and ::1
  if (groups.every((group) => group === 0)) return true;
  if (leadingZeros && groups[5] === 0 && groups[6] === 0 && groups[7] === 1) {
    return true;
  }
  // ::ffff:0:0/96 IPv4-mapped, and ::/96 IPv4-compatible
  if (leadingZeros && (groups[5] === 0xffff || groups[5] === 0)) {
    return embeddedV4();
  }
  // 64:ff9b::/96 NAT64
  if (groups[0] === 0x0064 && groups[1] === 0xff9b) return embeddedV4();
  // fe80::/10 link-local
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  // fc00::/7 unique local
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  // ff00::/8 multicast
  if ((groups[0] & 0xff00) === 0xff00) return true;

  return false;
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 6) return isPrivateIPv6(address);
  if (version === 4) return isPrivateIPv4(address);
  // Not an address at all — refuse it.
  return true;
}

async function assertPublicUrl(target: URL): Promise<void> {
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new UnfurlError("That link needs to start with http or https");
  }

  // URL.hostname keeps the brackets on IPv6 literals; strip them so the
  // address check sees a bare address rather than falling through to DNS.
  const host = target.hostname.toLowerCase().replace(/^\[(.+)\]$/, "$1");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new UnfurlError("That address is not reachable from here");
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new UnfurlError("That address is not reachable from here");
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnfurlError("We could not find that shop");
  }
  if (
    !addresses.length ||
    addresses.some((entry) => isPrivateAddress(entry.address))
  ) {
    throw new UnfurlError("That address is not reachable from here");
  }
}

/* ------------------------------------------------------------------ *
 *  Fetching
 * ------------------------------------------------------------------ */

async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      // The metadata we want lives in <head>; stop well before a full page.
      if (total >= MAX_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return chunks.join("");
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

/**
 * Follows redirects by hand, re-checking every hop.
 *
 * `redirect: "follow"` would let a public URL bounce the fetch to an internal
 * address, which is precisely what `assertPublicUrl` exists to prevent — the
 * guard has to run on the destination as well as the starting point.
 */
async function fetchPage(start: URL): Promise<{ html: string; finalUrl: URL }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let target = start;

  try {
    for (let hop = 0; ; hop++) {
      const response = await fetch(target, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-IN,en;q=0.9",
        },
      });

      const location = response.headers.get("location");
      if (REDIRECT_CODES.has(response.status) && location) {
        if (hop >= MAX_REDIRECTS) {
          throw new UnfurlError("That link redirects in circles", 502);
        }
        let next: URL;
        try {
          next = new URL(location, target);
        } catch {
          throw new UnfurlError("That shop sent us somewhere unreadable", 502);
        }
        await assertPublicUrl(next);
        target = next;
        continue;
      }

      if (!response.ok) {
        // 401/403/429 mean the shop is refusing us specifically, which the
        // hint attached upstream explains and offers a way around.
        const refused = [401, 403, 429].includes(response.status);
        throw new UnfurlError(
          refused
            ? "That shop would not let us read the page"
            : `The shop answered ${response.status}`,
          502,
        );
      }

      const type = response.headers.get("content-type") ?? "";
      if (type && !type.includes("html") && !type.includes("xml")) {
        throw new UnfurlError("That link is not a product page", 415);
      }

      return { html: await readCapped(response), finalUrl: target };
    }
  } catch (error) {
    if (error instanceof UnfurlError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new UnfurlError("The shop took too long to answer", 504);
    }
    throw new UnfurlError("We could not reach that shop", 502);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 *  Parsing
 * ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  hellip: "…",
  ndash: "–",
  mdash: "—",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => ENTITIES[name.toLowerCase()] ?? match,
    )
    .trim();
}

/** Pulls a meta tag's content regardless of attribute order or quoting. */
function meta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name|itemprop)\\s*=\\s*["']${escaped}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const value = decodeEntities(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function firstMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const value = meta(html, key);
    if (value) return value;
  }
  return null;
}

/**
 * Reads a price out of whatever a boutique wrote.
 *
 *   "₹1,299"     → 1299     (Indian grouping — the common case)
 *   "Rs. 1,299"  → 1299     (the "Rs." dot must not become a decimal point)
 *   "₹12,34,567" → 1234567  (lakh grouping)
 *   "₹4,990.00"  → 4990
 *   "4.990,50"   → 4990.5   (European)
 *   "999.5"      → 999.5
 *
 * The trailing separator decides: three digits after it means grouping, one or
 * two means a decimal point.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? input : null;
  }
  if (typeof input !== "string") return null;

  // Keep digits and separators, then drop separators that cannot belong to the
  // number — otherwise the dot in "Rs. 1299" reads as a decimal point.
  const cleaned = input
    .replace(/[^\d.,]/g, "")
    .replace(/^[.,]+/, "")
    .replace(/[.,]+$/, "");
  if (!/\d/.test(cleaned)) return null;

  const lastSeparator = Math.max(
    cleaned.lastIndexOf(","),
    cleaned.lastIndexOf("."),
  );
  let normalised: string;

  if (lastSeparator === -1) {
    normalised = cleaned;
  } else {
    const digitsAfter = cleaned.length - lastSeparator - 1;
    const separator = cleaned[lastSeparator];
    const separatorCount = cleaned.split(separator).length - 1;
    const groupedThroughout = /^\d{1,3}([.,]\d{3})+$/.test(cleaned);

    if (digitsAfter === 3 && (separatorCount > 1 || groupedThroughout)) {
      // Every separator is thousands grouping.
      normalised = cleaned.replace(/[.,]/g, "");
    } else if (digitsAfter === 1 || digitsAfter === 2) {
      // The last separator is the decimal point; the rest is grouping.
      const whole = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "");
      normalised = `${whole}.${cleaned.slice(lastSeparator + 1)}`;
    } else {
      normalised = cleaned.replace(/[.,]/g, "");
    }
  }

  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === "object" && value !== null;
}

function typesOf(node: Bag): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase());
  }
  return [];
}

/** Depth-first hunt for the first schema.org Product in any JSON-LD block. */
function findProduct(node: unknown, depth = 0): Bag | null {
  if (depth > 8 || !isBag(node)) return null;

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findProduct(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typesOf(node).includes("product")) return node;

  for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant"]) {
    if (key in node) {
      const found = findProduct(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function jsonLdProduct(html: string): Bag | null {
  const blocks = html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    try {
      const found = findProduct(JSON.parse(raw));
      if (found) return found;
    } catch {
      // Malformed block — boutiques ship these more often than you'd think.
    }
  }
  return null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return decodeEntities(value) || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  if (isBag(value)) {
    for (const key of ["name", "url", "contentUrl", "@id", "value"]) {
      if (key in value) {
        const found = firstString(value[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

function offersOf(product: Bag): Bag[] {
  const raw = product.offers;
  if (Array.isArray(raw)) return raw.filter(isBag);
  if (isBag(raw)) {
    // AggregateOffer wraps the real ones.
    if (Array.isArray(raw.offers)) return [raw, ...raw.offers.filter(isBag)];
    return [raw];
  }
  return [];
}

function absolutise(value: string | null, base: URL): string | null {
  if (!value) return null;
  try {
    const resolved = new URL(value, base);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:")
      return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function titleTag(html: string): string | null {
  const match = /<title[^>]*>([\s\S]{1,300}?)<\/title>/i.exec(html);
  return match?.[1] ? decodeEntities(match[1]) : null;
}

/** Trims the boutique's own name off the end of a page title. */
function tidyTitle(title: string, siteName: string | null): string {
  let value = title.replace(/\s+/g, " ").trim();
  if (siteName) {
    const pattern = new RegExp(
      `\\s*[|\\-–—:]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
      "i",
    );
    value = value.replace(pattern, "");
  }
  return value
    .replace(/\s*[|\-–—]\s*(buy online|shop online|online).*$/i, "")
    .trim();
}

export function parseProductPage(html: string, target: URL): Unfurled {
  const product = jsonLdProduct(html);
  const offers = product ? offersOf(product) : [];

  const siteName = firstMeta(html, ["og:site_name", "application-name"]);

  const rawTitle =
    (product ? firstString(product.name) : null) ??
    firstMeta(html, ["og:title", "twitter:title"]) ??
    titleTag(html);

  const price =
    parseMoney(offers.map((offer) => offer.price).find((value) => value != null)) ??
    parseMoney(
      offers.map((offer) => offer.lowPrice).find((value) => value != null),
    ) ??
    parseMoney(
      firstMeta(html, [
        "product:price:amount",
        "og:price:amount",
        "twitter:data1",
        "price",
      ]),
    );

  const originalPrice =
    parseMoney(
      firstMeta(html, [
        "product:original_price:amount",
        "og:price:standard_amount",
        "product:price:standard_amount",
      ]),
    ) ?? parseMoney(offers.map((offer) => offer.highPrice).find((v) => v != null));

  const currency = (
    offers
      .map((offer) => offer.priceCurrency)
      .find((value): value is string => typeof value === "string") ??
    firstMeta(html, ["product:price:currency", "og:price:currency"]) ??
    "INR"
  ).toUpperCase();

  const brand =
    (product ? firstString(product.brand) : null) ??
    firstMeta(html, ["product:brand", "brand"]);

  const color =
    (product ? firstString(product.color) : null) ??
    firstMeta(html, ["product:color"]);

  const size =
    (product ? firstString(product.size) : null) ??
    firstMeta(html, ["product:size"]);

  const imageUrl = absolutise(
    (product ? firstString(product.image) : null) ??
      firstMeta(html, ["og:image:secure_url", "og:image", "twitter:image"]),
    target,
  );

  const title = rawTitle ? tidyTitle(rawTitle, siteName) : null;

  return {
    url: target.toString(),
    title: title || null,
    brand: brand || null,
    store: storeFromUrl(target.toString()),
    category: categorise(title, brand, firstMeta(html, ["og:description"])),
    imageUrl,
    price,
    // Never present a "was" price that isn't above the current one.
    originalPrice:
      originalPrice != null && price != null && originalPrice > price
        ? originalPrice
        : null,
    currency,
    color: color || null,
    size: size || null,
    siteName: siteName || null,
  };
}

/**
 * Just today's price, for the tracker. Unlike `unfurl` this does not insist the
 * page yielded a name or a photograph — a page that only still shows a figure
 * is perfectly useful when we already know what the piece is.
 */
export async function probePrice(rawUrl: string): Promise<{
  price: number | null;
  originalPrice: number | null;
  availability: "in_stock" | "low_stock" | "out_of_stock" | null;
}> {
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw new UnfurlError("That does not look like a link");
  }

  await assertPublicUrl(target);
  const { html, finalUrl } = await fetchPage(target);
  const parsed = parseProductPage(html, finalUrl);

  // Schema.org availability, when the page states it.
  const availabilityRaw = (
    /"availability"\s*:\s*"([^"]+)"/i.exec(html)?.[1] ?? ""
  ).toLowerCase();
  const availability = availabilityRaw.includes("outofstock")
    ? ("out_of_stock" as const)
    : availabilityRaw.includes("limitedavailability")
      ? ("low_stock" as const)
      : availabilityRaw.includes("instock")
        ? ("in_stock" as const)
        : null;

  return {
    price: parsed.price,
    originalPrice: parsed.originalPrice,
    availability,
  };
}

/** Fetches a product page and reads whatever it is willing to tell us. */
export async function unfurl(rawUrl: string): Promise<Unfurled> {
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw new UnfurlError("That does not look like a link");
  }

  await assertPublicUrl(target);
  const store = storeFromUrl(target.toString());
  const label = getStore(store).label;
  const hint = extensionHint(store);

  try {
    // Parse against the URL we actually landed on, so relative images resolve
    // and the saved link is the canonical one.
    const { html, finalUrl } = await fetchPage(target);
    const result = parseProductPage(html, finalUrl);

    if (!result.title && !result.imageUrl) {
      const failure = new UnfurlError(
        hint
          ? `${label} did not share this piece's details`
          : "That page did not share any details",
        422,
      );
      failure.hint =
        hint ?? "You can still fill it in by hand — it will look just as good.";
      throw failure;
    }
    return result;
  } catch (error) {
    // Attach the shop-specific route forward, so the message is never a
    // dead end. Guard failures already carry their own wording.
    if (error instanceof UnfurlError && !error.hint && error.status >= 500) {
      error.hint =
        hint ?? "You can still fill it in by hand — it will look just as good.";
    }
    throw error;
  }
}
