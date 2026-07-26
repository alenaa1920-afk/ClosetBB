import type { SupabaseClient } from "@supabase/supabase-js";
import { isCategoryKey, type CategoryKey } from "@/lib/domain/categories";
import { isStoreKey, type StoreKey } from "@/lib/domain/stores";
import {
  discountPercent,
  isAvailability,
  type Collection,
  type PricePoint,
  type Product,
  type ProductDraft,
} from "@/lib/domain/product";
import type {
  CollectionTableRow,
  Database,
  ProductExpandedRow,
} from "@/lib/supabase/database.types";
import {
  RepositoryError,
  type CollectionPatch,
  type WardrobeRepository,
  type WardrobeSnapshot,
} from "./repository";

type Client = SupabaseClient<Database>;

/* ------------------------------------------------------------------ *
 *  Row mapping
 * ------------------------------------------------------------------ */

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPriceHistory(value: unknown): PricePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const price = toNumber(record.price);
      const recordedAt = record.recordedAt ?? record.recorded_at;
      if (price == null || typeof recordedAt !== "string") return null;
      return { price, recordedAt };
    })
    .filter((point): point is PricePoint => point !== null);
}

function asStore(value: string): StoreKey {
  return isStoreKey(value) ? value : "other";
}

function asCategory(value: string): CategoryKey {
  return isCategoryKey(value) ? value : "others";
}

export function rowToProduct(row: ProductExpandedRow): Product {
  const product: Product = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    brand: row.brand,
    store: asStore(row.store),
    category: asCategory(row.category),
    price: toNumber(row.price),
    originalPrice: toNumber(row.original_price),
    currency: row.currency || "INR",
    discount: row.discount,
    imageUrl: row.image_url,
    productUrl: row.product_url,
    size: row.size,
    sizesAvailable: row.sizes_available ?? [],
    color: row.color,
    quantity: row.quantity,
    seller: row.seller,
    rating: toNumber(row.rating),
    ratingCount: row.rating_count,
    sku: row.sku,
    availability: isAvailability(row.availability) ? row.availability : null,
    note: row.note,
    favorite: Boolean(row.favorite),
    tracking: row.tracking ?? true,
    lastCheckedAt: row.last_checked_at,
    collectionIds: row.collection_ids ?? [],
    priceHistory: toPriceHistory(row.price_history),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (product.discount == null) product.discount = discountPercent(product);
  return product;
}

function rowToCollection(
  row: CollectionTableRow,
  productIds: string[],
): Collection {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    productIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type CollectionUpdate = Database["public"]["Tables"]["collections"]["Update"];

/** Only the columns the products table actually owns. */
function toProductColumns(patch: Partial<Product>): ProductUpdate {
  const columns: ProductUpdate = {};
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.brand !== undefined) columns.brand = patch.brand;
  if (patch.store !== undefined) columns.store = patch.store;
  if (patch.category !== undefined) columns.category = patch.category;
  if (patch.price !== undefined) columns.price = patch.price;
  if (patch.originalPrice !== undefined)
    columns.original_price = patch.originalPrice;
  if (patch.currency !== undefined) columns.currency = patch.currency;
  if (patch.discount !== undefined) columns.discount = patch.discount;
  if (patch.imageUrl !== undefined) columns.image_url = patch.imageUrl;
  if (patch.productUrl !== undefined) columns.product_url = patch.productUrl;
  if (patch.size !== undefined) columns.size = patch.size;
  if (patch.sizesAvailable !== undefined)
    columns.sizes_available = patch.sizesAvailable;
  if (patch.color !== undefined) columns.color = patch.color;
  if (patch.quantity !== undefined) columns.quantity = patch.quantity;
  if (patch.seller !== undefined) columns.seller = patch.seller;
  if (patch.rating !== undefined) columns.rating = patch.rating;
  if (patch.ratingCount !== undefined) columns.rating_count = patch.ratingCount;
  if (patch.sku !== undefined) columns.sku = patch.sku;
  if (patch.availability !== undefined) columns.availability = patch.availability;
  if (patch.note !== undefined) columns.note = patch.note;
  if (patch.tracking !== undefined) columns.tracking = patch.tracking;
  if (patch.lastCheckedAt !== undefined)
    columns.last_checked_at = patch.lastCheckedAt;
  return columns;
}

/* ------------------------------------------------------------------ *
 *  Repository
 * ------------------------------------------------------------------ */

export class SupabaseRepository implements WardrobeRepository {
  readonly kind = "supabase" as const;

  constructor(
    private readonly client: Client,
    private readonly userId: string,
  ) {}

  private async expanded(id: string): Promise<Product> {
    const { data, error } = await this.client
      .from("products_expanded")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      throw new RepositoryError("Could not read the piece back", error);
    }
    return rowToProduct(data);
  }

  async load(): Promise<WardrobeSnapshot> {
    const [productsResult, collectionsResult, linksResult] = await Promise.all([
      this.client
        .from("products_expanded")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false }),
      this.client
        .from("collections")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: true }),
      this.client.from("collection_products").select("collection_id, product_id"),
    ]);

    if (productsResult.error) {
      throw new RepositoryError(
        "Could not open the wardrobe",
        productsResult.error,
      );
    }
    if (collectionsResult.error) {
      throw new RepositoryError(
        "Could not read your collections",
        collectionsResult.error,
      );
    }

    const membership = new Map<string, string[]>();
    for (const link of linksResult.data ?? []) {
      const list = membership.get(link.collection_id) ?? [];
      list.push(link.product_id);
      membership.set(link.collection_id, list);
    }

    return {
      userId: this.userId,
      products: (productsResult.data ?? []).map(rowToProduct),
      collections: (collectionsResult.data ?? []).map((row) =>
        rowToCollection(row, membership.get(row.id) ?? []),
      ),
    };
  }

  async addProduct(draft: ProductDraft): Promise<Product> {
    const { data, error } = await this.client
      .from("products")
      .upsert(
        {
          user_id: this.userId,
          title: draft.title.trim(),
          brand: draft.brand ?? null,
          store: draft.store ?? "other",
          category: draft.category ?? "others",
          price: draft.price ?? null,
          original_price: draft.originalPrice ?? null,
          currency: draft.currency ?? "INR",
          discount: draft.discount ?? null,
          image_url: draft.imageUrl ?? null,
          product_url: draft.productUrl ?? null,
          size: draft.size ?? null,
          sizes_available: draft.sizesAvailable ?? [],
          color: draft.color ?? null,
          quantity: draft.quantity ?? null,
          seller: draft.seller ?? null,
          rating: draft.rating ?? null,
          rating_count: draft.ratingCount ?? null,
          sku: draft.sku ?? null,
          availability: draft.availability ?? null,
          note: draft.note ?? null,
          tracking: draft.tracking ?? true,
        },
        { onConflict: "user_id,product_url", ignoreDuplicates: false },
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new RepositoryError("Could not save this piece", error);
    }

    if (draft.favorite) await this.setFavorite(data.id, true);
    if (draft.collectionIds?.length) {
      await this.setProductCollections(data.id, draft.collectionIds);
    }

    return this.expanded(data.id);
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const columns = toProductColumns(patch);

    if (Object.keys(columns).length) {
      const { error } = await this.client
        .from("products")
        .update(columns)
        .eq("id", id)
        .eq("user_id", this.userId);
      if (error) throw new RepositoryError("Could not update this piece", error);
    }

    if (patch.favorite !== undefined) {
      await this.setFavorite(id, patch.favorite);
    }
    if (patch.collectionIds !== undefined) {
      await this.setProductCollections(id, patch.collectionIds);
    }

    return this.expanded(id);
  }

  async removeProduct(id: string): Promise<void> {
    const { error } = await this.client
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw new RepositoryError("Could not remove this piece", error);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    if (favorite) {
      const { error } = await this.client
        .from("favorites")
        .upsert({ user_id: this.userId, product_id: id });
      if (error) throw new RepositoryError("Could not save the favourite", error);
      return;
    }
    const { error } = await this.client
      .from("favorites")
      .delete()
      .eq("user_id", this.userId)
      .eq("product_id", id);
    if (error) throw new RepositoryError("Could not remove the favourite", error);
  }

  async createCollection(name: string, emoji?: string | null): Promise<Collection> {
    const { data, error } = await this.client
      .from("collections")
      .insert({ user_id: this.userId, name: name.trim(), emoji: emoji ?? null })
      .select("*")
      .single();
    if (error || !data) {
      const duplicate = error?.code === "23505";
      throw new RepositoryError(
        duplicate
          ? `"${name.trim()}" already exists`
          : "Could not create that collection",
        error,
      );
    }
    return rowToCollection(data, []);
  }

  async updateCollection(id: string, patch: CollectionPatch): Promise<Collection> {
    const columns: CollectionUpdate = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) columns.name = patch.name.trim();
    if (patch.emoji !== undefined) columns.emoji = patch.emoji;

    const { data, error } = await this.client
      .from("collections")
      .update(columns)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .single();
    if (error || !data) {
      throw new RepositoryError("Could not rename that collection", error);
    }

    const { data: links } = await this.client
      .from("collection_products")
      .select("product_id")
      .eq("collection_id", id);

    return rowToCollection(
      data,
      (links ?? []).map((link) => link.product_id),
    );
  }

  async removeCollection(id: string): Promise<void> {
    const { error } = await this.client
      .from("collections")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw new RepositoryError("Could not remove that collection", error);
  }

  async setProductCollections(
    productId: string,
    collectionIds: string[],
  ): Promise<void> {
    const unique = [...new Set(collectionIds)];

    const { error: clearError } = await this.client
      .from("collection_products")
      .delete()
      .eq("product_id", productId);
    if (clearError) {
      throw new RepositoryError("Could not update collections", clearError);
    }

    if (!unique.length) return;

    const { error } = await this.client
      .from("collection_products")
      .insert(
        unique.map((collection_id) => ({ collection_id, product_id: productId })),
      );
    if (error) throw new RepositoryError("Could not update collections", error);
  }
}
