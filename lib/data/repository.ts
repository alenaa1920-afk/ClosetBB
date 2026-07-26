import type { Collection, Product, ProductDraft } from "@/lib/domain/product";

export interface WardrobeSnapshot {
  userId: string;
  products: Product[];
  collections: Collection[];
}

export interface CollectionPatch {
  name?: string;
  emoji?: string | null;
}

/**
 * Everything the interface needs from storage. Two adapters implement it:
 * Supabase (the real wardrobe) and the local atelier (a seeded demo used when
 * no keys are configured), so no component ever knows which is live.
 */
export interface WardrobeRepository {
  readonly kind: "supabase" | "atelier";

  load(): Promise<WardrobeSnapshot>;

  addProduct(draft: ProductDraft): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  removeProduct(id: string): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;

  createCollection(name: string, emoji?: string | null): Promise<Collection>;
  updateCollection(id: string, patch: CollectionPatch): Promise<Collection>;
  removeCollection(id: string): Promise<void>;

  /** Replaces a product's whole collection membership set. */
  setProductCollections(productId: string, collectionIds: string[]): Promise<void>;
}

/** Pulls something human out of a PostgrestError without leaking internals. */
function describeCause(cause: unknown): string | null {
  if (!cause || typeof cause !== "object") return null;
  const error = cause as { message?: unknown; code?: unknown; details?: unknown };
  const parts: string[] = [];
  if (typeof error.message === "string" && error.message) parts.push(error.message);
  if (typeof error.details === "string" && error.details) parts.push(error.details);
  if (typeof error.code === "string" && error.code) parts.push(`(${error.code})`);
  return parts.length ? parts.join(" ") : null;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    // Keep the database's own words. A bare "Could not save this piece" sends
    // you guessing; "no unique or exclusion constraint... (42P10)" does not.
    const detail = describeCause(cause);
    super(detail ? `${message} — ${detail}` : message);
    this.name = "RepositoryError";
    if (cause) console.error(`[repository] ${message}`, cause);
  }
}
