/**
 * The boutiques Mon Amour gathers from.
 *
 * Adding a house is a single entry here — badges, filters, URL detection and
 * the extension's site matching all read from this registry.
 */

export interface StoreDefinition {
  label: string;
  /** Signature colour. Drives badge tint, ring and hover glow. */
  color: string;
  /** Substitute for houses whose signature colour vanishes on a dark ground. */
  colorDark?: string;
  /** Optional two-stop sweep for houses with a gradient identity. */
  gradient?: readonly [string, string];
  /** Hostname fragments used to recognise a pasted or scraped URL. */
  hosts: readonly string[];
  /** Whether the Chrome extension ships a scraper for this house yet. */
  extension: "live" | "planned";
  /**
   * Whether pasting a link can work, measured against the live sites.
   *
   *   open    — serves metadata to a plain server fetch. Paste-a-link works.
   *   blocked — answers 403 to anything that is not a real browser.
   *   spa     — renders in JavaScript and ships no metadata in the HTML.
   *
   * `blocked` and `spa` are exactly why the extension exists: it reads the
   * page from inside her browser, where neither problem applies.
   */
  serverFetch: "open" | "blocked" | "spa";
  home: string;
}

export const STORES = {
  myntra: {
    label: "Myntra",
    color: "#ff3f6c",
    hosts: ["myntra.com"],
    extension: "live",
    serverFetch: "open",
    home: "https://www.myntra.com",
  },
  savana: {
    label: "Savana",
    color: "#7c3aed",
    hosts: ["savana.com", "savana.in"],
    extension: "live",
    serverFetch: "open",
    home: "https://www.savana.com",
  },
  zara: {
    label: "Zara",
    color: "#111827",
    colorDark: "#e7e5e4",
    hosts: ["zara.com"],
    extension: "live",
    serverFetch: "spa",
    home: "https://www.zara.com",
  },
  hm: {
    label: "H&M",
    color: "#e50010",
    hosts: ["hm.com", "www2.hm.com"],
    extension: "live",
    serverFetch: "blocked",
    home: "https://www2.hm.com",
  },
  ajio: {
    label: "Ajio",
    color: "#2563eb",
    hosts: ["ajio.com"],
    extension: "live",
    serverFetch: "blocked",
    home: "https://www.ajio.com",
  },
  urbanic: {
    label: "Urbanic",
    color: "#a78bfa",
    hosts: ["urbanic.com"],
    extension: "live",
    serverFetch: "open",
    home: "https://www.urbanic.com",
  },
  nykaa: {
    label: "Nykaa",
    color: "#fc2779",
    gradient: ["#fc2779", "#ff8ab5"],
    hosts: ["nykaa.com", "nykaafashion.com"],
    extension: "live",
    serverFetch: "open",
    home: "https://www.nykaa.com",
  },
  other: {
    label: "Boutique",
    color: "#f472b6",
    hosts: [],
    extension: "planned",
    serverFetch: "open",
    home: "",
  },
} as const satisfies Record<string, StoreDefinition>;

export type StoreKey = keyof typeof STORES;

/** Presentation order — `other` always trails. */
export const STORE_KEYS = Object.keys(STORES) as StoreKey[];

export function isStoreKey(value: unknown): value is StoreKey {
  return typeof value === "string" && value in STORES;
}

export function getStore(key: StoreKey | string): StoreDefinition {
  return isStoreKey(key) ? STORES[key] : STORES.other;
}

export function storeLabel(key: StoreKey | string): string {
  return getStore(key).label;
}

/** Recognise the house from a product URL's hostname. */
export function storeFromUrl(url: string): StoreKey {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  for (const key of STORE_KEYS) {
    if (key === "other") continue;
    for (const fragment of STORES[key].hosts) {
      if (host === fragment || host.endsWith(`.${fragment}`)) return key;
      // `www2.hm.com` style hosts are listed verbatim.
      if (host === fragment.replace(/^www\./, "")) return key;
    }
  }
  return "other";
}

/**
 * Why a link could not be read, and what to do instead. Null when the shop is
 * one we can normally read, in which case the failure was something else.
 */
export function extensionHint(store: StoreKey | string): string | null {
  const definition = getStore(store);
  if (definition.serverFetch === "open") return null;

  const because =
    definition.serverFetch === "blocked"
      ? `${definition.label} refuses requests that don't come from a real browser`
      : `${definition.label} builds its pages in JavaScript, so the details never arrive in the page our server receives`;

  return `${because}. Open the piece on ${definition.label} and press the Mon Amour extension — it reads the page from inside your own browser, where that isn't a problem.`;
}

/** Match a free-text site name ("Myntra", "H&M") back onto a key. */
export function storeFromName(name: string | null | undefined): StoreKey | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  for (const key of STORE_KEYS) {
    if (key === "other") continue;
    if (STORES[key].label.toLowerCase() === needle) return key;
    if (key === needle) return key;
  }
  return null;
}
