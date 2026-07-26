import { CATEGORIES, categoryLabel, type CategoryKey } from "./categories";
import { getStore, type StoreKey } from "./stores";

/* ------------------------------------------------------------------ *
 *  Entities
 * ------------------------------------------------------------------ */

export interface PricePoint {
  price: number;
  recordedAt: string;
}

export interface Product {
  id: string;
  userId: string;
  title: string;
  brand: string | null;
  store: StoreKey;
  category: CategoryKey;
  /** What it costs today. */
  price: number | null;
  /** Struck-through list price, when the boutique showed one. */
  originalPrice: number | null;
  currency: string;
  /** Percent off. Derived from the two prices when the source didn't say. */
  discount: number | null;
  imageUrl: string | null;
  productUrl: string | null;
  /** The size she actually chose, as her cart recorded it. */
  size: string | null;
  /** Every size the shop offered, when the page listed them. */
  sizesAvailable: string[];
  color: string | null;
  /** How many she had in the bag. */
  quantity: number | null;
  seller: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** The shop's own product code. */
  sku: string | null;
  availability: Availability | null;
  /** A private line from me to her. Shown only in the detail view. */
  note: string | null;
  favorite: boolean;
  /** Whether we keep re-checking the price. */
  tracking: boolean;
  lastCheckedAt: string | null;
  collectionIds: string[];
  priceHistory: PricePoint[];
  createdAt: string;
  updatedAt: string;
}

export const AVAILABILITY = {
  in_stock: "In stock",
  low_stock: "Only a few left",
  out_of_stock: "Sold out",
} as const;

export type Availability = keyof typeof AVAILABILITY;

export function isAvailability(value: unknown): value is Availability {
  return typeof value === "string" && value in AVAILABILITY;
}

export function availabilityLabel(value: Availability | null): string | null {
  return value ? AVAILABILITY[value] : null;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  /** A single glyph standing in for a cover image. */
  emoji: string | null;
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Anything may be supplied; only a name is required. */
export type ProductDraft = Partial<Product> & Pick<Product, "title">;

/* ------------------------------------------------------------------ *
 *  Derived values
 * ------------------------------------------------------------------ */

/** Percent off, from the stored figure or the two prices. Null when neither. */
export function discountPercent(product: Product): number | null {
  if (product.discount != null && product.discount > 0) {
    return Math.round(product.discount);
  }
  const { price, originalPrice } = product;
  if (price == null || originalPrice == null) return null;
  if (originalPrice <= price || originalPrice <= 0) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export function savings(product: Product): number | null {
  const { price, originalPrice } = product;
  if (price == null || originalPrice == null || originalPrice <= price) return null;
  return originalPrice - price;
}

export interface PriceDrop {
  from: number;
  to: number;
  amount: number;
  percent: number;
}

/**
 * A drop since the last time we looked. `priceHistory` is ascending by date;
 * we walk back to the most recent figure that differed from today's.
 */
export function priceDrop(product: Product): PriceDrop | null {
  const to = product.price;
  if (to == null) return null;
  for (let i = product.priceHistory.length - 1; i >= 0; i--) {
    const from = product.priceHistory[i].price;
    if (from === to) continue;
    if (from < to) return null; // it went up; say nothing
    return {
      from,
      to,
      amount: from - to,
      percent: Math.round(((from - to) / from) * 100),
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Search, filtering, sorting
 * ------------------------------------------------------------------ */

export const SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  discount: "Highest discount",
  priceAsc: "Price: low to high",
  priceDesc: "Price: high to low",
} as const;

export type SortKey = keyof typeof SORTS;
export const SORT_KEYS = Object.keys(SORTS) as SortKey[];

export const PRICE_BANDS = {
  under1000: { label: "Under ₹1,000", min: 0, max: 1000 },
  mid: { label: "₹1,000 – ₹3,000", min: 1000, max: 3000 },
  upper: { label: "₹3,000 – ₹6,000", min: 3000, max: 6000 },
  luxury: { label: "₹6,000 and above", min: 6000, max: Infinity },
} as const;

export type PriceBandKey = keyof typeof PRICE_BANDS;
export const PRICE_BAND_KEYS = Object.keys(PRICE_BANDS) as PriceBandKey[];

export interface Filters {
  query: string;
  stores: StoreKey[];
  categories: CategoryKey[];
  colors: string[];
  priceBands: PriceBandKey[];
  favoritesOnly: boolean;
  collectionId: string | null;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  stores: [],
  categories: [],
  colors: [],
  priceBands: [],
  favoritesOnly: false,
  collectionId: null,
  sort: "newest",
};

export function activeFilterCount(filters: Filters): number {
  return (
    filters.stores.length +
    filters.categories.length +
    filters.colors.length +
    filters.priceBands.length +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.collectionId ? 1 : 0)
  );
}

/** Everything a search query is allowed to match against. */
export function searchText(product: Product): string {
  return [
    product.title,
    product.brand,
    getStore(product.store).label,
    categoryLabel(product.category),
    product.color,
    product.size,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(product: Product, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const haystack = searchText(product);
  return tokens.every((token) => haystack.includes(token));
}

function inAnyBand(price: number | null, bands: PriceBandKey[]): boolean {
  if (!bands.length) return true;
  if (price == null) return false;
  return bands.some((key) => {
    const band = PRICE_BANDS[key];
    return price >= band.min && price < band.max;
  });
}

export function filterProducts(products: Product[], filters: Filters): Product[] {
  const tokens = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const colors = filters.colors.map((c) => c.toLowerCase());

  return products.filter((product) => {
    if (filters.favoritesOnly && !product.favorite) return false;
    if (
      filters.collectionId &&
      !product.collectionIds.includes(filters.collectionId)
    ) {
      return false;
    }
    if (filters.stores.length && !filters.stores.includes(product.store))
      return false;
    if (
      filters.categories.length &&
      !filters.categories.includes(product.category)
    ) {
      return false;
    }
    if (colors.length && !colors.includes((product.color ?? "").toLowerCase())) {
      return false;
    }
    if (!inAnyBand(product.price, filters.priceBands)) return false;
    return matchesQuery(product, tokens);
  });
}

/** Nulls always sink, whichever direction we are sorting. */
function comparePrice(
  a: number | null,
  b: number | null,
  direction: 1 | -1,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * direction;
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "discount":
      return sorted.sort(
        (a, b) => (discountPercent(b) ?? -1) - (discountPercent(a) ?? -1),
      );
    case "priceAsc":
      return sorted.sort((a, b) => comparePrice(a.price, b.price, 1));
    case "priceDesc":
      return sorted.sort((a, b) => comparePrice(b.price, a.price, 1));
    case "newest":
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function selectProducts(products: Product[], filters: Filters): Product[] {
  return sortProducts(filterProducts(products, filters), filters.sort);
}

/** Distinct colours present in the wardrobe, alphabetical. */
export function availableColors(products: Product[]): string[] {
  const seen = new Map<string, string>();
  for (const product of products) {
    const raw = product.color?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Counts per drawer, used to grey out empty filter options. */
export function categoryCounts(products: Product[]): Record<CategoryKey, number> {
  const counts = Object.fromEntries(
    Object.keys(CATEGORIES).map((key) => [key, 0]),
  ) as Record<CategoryKey, number>;
  for (const product of products) counts[product.category] += 1;
  return counts;
}

export function storeCounts(
  products: Product[],
): Partial<Record<StoreKey, number>> {
  const counts: Partial<Record<StoreKey, number>> = {};
  for (const product of products) {
    counts[product.store] = (counts[product.store] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 *  Construction
 * ------------------------------------------------------------------ */

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** Fills a partial draft out into a complete product. */
export function buildProduct(draft: ProductDraft, userId: string): Product {
  const now = new Date().toISOString();
  const price = draft.price ?? null;
  const product: Product = {
    id: draft.id ?? newId(),
    userId: draft.userId ?? userId,
    title: draft.title.trim(),
    brand: draft.brand?.trim() || null,
    store: draft.store ?? "other",
    category: draft.category ?? "others",
    price,
    originalPrice: draft.originalPrice ?? null,
    currency: draft.currency ?? "INR",
    discount: draft.discount ?? null,
    imageUrl: draft.imageUrl ?? null,
    productUrl: draft.productUrl ?? null,
    size: draft.size?.trim() || null,
    sizesAvailable: draft.sizesAvailable ?? [],
    color: draft.color?.trim() || null,
    quantity: draft.quantity ?? null,
    seller: draft.seller?.trim() || null,
    rating: draft.rating ?? null,
    ratingCount: draft.ratingCount ?? null,
    sku: draft.sku?.trim() || null,
    availability: draft.availability ?? null,
    note: draft.note?.trim() || null,
    favorite: draft.favorite ?? false,
    tracking: draft.tracking ?? true,
    lastCheckedAt: draft.lastCheckedAt ?? null,
    collectionIds: draft.collectionIds ?? [],
    priceHistory:
      draft.priceHistory ?? (price != null ? [{ price, recordedAt: now }] : []),
    createdAt: now,
    updatedAt: now,
  };
  // Never keep a discount that the prices contradict.
  if (product.discount == null) product.discount = discountPercent(product);
  return product;
}

export function buildCollection(
  name: string,
  userId: string,
  emoji?: string,
): Collection {
  const now = new Date().toISOString();
  return {
    id: newId(),
    userId,
    name: name.trim(),
    emoji: emoji ?? null,
    productIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Collections we offer on a fresh account. */
export const STARTER_COLLECTIONS: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: "Date Night", emoji: "🥂" },
  { name: "Vacation", emoji: "🌊" },
  { name: "Birthday", emoji: "🎀" },
  { name: "Wedding", emoji: "💍" },
  { name: "Winter", emoji: "❄️" },
  { name: "Summer", emoji: "☀️" },
  { name: "Girls Trip", emoji: "✨" },
  { name: "Work", emoji: "🖤" },
];
