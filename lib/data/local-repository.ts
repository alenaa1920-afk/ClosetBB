import {
  buildCollection,
  buildProduct,
  type Collection,
  type Product,
  type ProductDraft,
} from "@/lib/domain/product";
import { buildStarter } from "./starter";
import {
  RepositoryError,
  type CollectionPatch,
  type WardrobeRepository,
  type WardrobeSnapshot,
} from "./repository";

const STORAGE_KEY = "mon-amour.atelier.v2";
export const ATELIER_USER_ID = "atelier";

interface Persisted {
  version: 1;
  userId: string;
  products: Product[];
  collections: Collection[];
}

/**
 * The local atelier. Used when no Supabase keys are present: the wardrobe is
 * kept in this browser and starts empty, with only the occasions rail ready.
 */
export class LocalRepository implements WardrobeRepository {
  readonly kind = "atelier" as const;

  private snapshot: WardrobeSnapshot | null = null;

  private read(): WardrobeSnapshot {
    if (this.snapshot) return this.snapshot;

    if (typeof window === "undefined") {
      this.snapshot = buildStarter(ATELIER_USER_ID);
      return this.snapshot;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        if (parsed?.version === 1 && Array.isArray(parsed.products)) {
          this.snapshot = {
            userId: parsed.userId ?? ATELIER_USER_ID,
            products: parsed.products,
            collections: parsed.collections ?? [],
          };
          return this.snapshot;
        }
      }
    } catch {
      // Corrupt payload — start the atelier over rather than fail to open.
    }

    this.snapshot = buildStarter(ATELIER_USER_ID);
    this.flush();
    return this.snapshot;
  }

  private flush() {
    if (typeof window === "undefined" || !this.snapshot) return;
    const payload: Persisted = { version: 1, ...this.snapshot };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or blocked; the session still works in memory.
    }
  }

  private product(id: string): Product {
    const found = this.read().products.find((p) => p.id === id);
    if (!found) throw new RepositoryError(`No product with id ${id}`);
    return found;
  }

  async load(): Promise<WardrobeSnapshot> {
    const snapshot = this.read();
    return {
      userId: snapshot.userId,
      products: [...snapshot.products],
      collections: [...snapshot.collections],
    };
  }

  async addProduct(draft: ProductDraft): Promise<Product> {
    const snapshot = this.read();
    const product = buildProduct(draft, snapshot.userId);
    snapshot.products = [product, ...snapshot.products];
    for (const id of product.collectionIds) {
      const collection = snapshot.collections.find((c) => c.id === id);
      if (collection && !collection.productIds.includes(product.id)) {
        collection.productIds = [product.id, ...collection.productIds];
      }
    }
    this.flush();
    return product;
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const snapshot = this.read();
    const current = this.product(id);
    const next: Product = {
      ...current,
      ...patch,
      id: current.id,
      userId: current.userId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Mirror the database trigger: a changed price becomes history.
    if (
      patch.price !== undefined &&
      patch.price !== null &&
      patch.price !== current.price
    ) {
      next.priceHistory = [
        ...current.priceHistory,
        { price: patch.price, recordedAt: next.updatedAt },
      ];
    }

    snapshot.products = snapshot.products.map((p) => (p.id === id ? next : p));
    this.flush();
    return next;
  }

  async removeProduct(id: string): Promise<void> {
    const snapshot = this.read();
    snapshot.products = snapshot.products.filter((p) => p.id !== id);
    for (const collection of snapshot.collections) {
      collection.productIds = collection.productIds.filter((pid) => pid !== id);
    }
    this.flush();
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await this.updateProduct(id, { favorite });
  }

  async createCollection(name: string, emoji?: string | null): Promise<Collection> {
    const snapshot = this.read();
    const existing = snapshot.collections.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (existing) throw new RepositoryError(`"${existing.name}" already exists`);

    const collection = buildCollection(name, snapshot.userId, emoji ?? undefined);
    snapshot.collections = [...snapshot.collections, collection];
    this.flush();
    return collection;
  }

  async updateCollection(id: string, patch: CollectionPatch): Promise<Collection> {
    const snapshot = this.read();
    const current = snapshot.collections.find((c) => c.id === id);
    if (!current) throw new RepositoryError(`No collection with id ${id}`);

    const next: Collection = {
      ...current,
      name: patch.name?.trim() || current.name,
      emoji: patch.emoji === undefined ? current.emoji : patch.emoji,
      updatedAt: new Date().toISOString(),
    };
    snapshot.collections = snapshot.collections.map((c) =>
      c.id === id ? next : c,
    );
    this.flush();
    return next;
  }

  async removeCollection(id: string): Promise<void> {
    const snapshot = this.read();
    snapshot.collections = snapshot.collections.filter((c) => c.id !== id);
    snapshot.products = snapshot.products.map((product) =>
      product.collectionIds.includes(id)
        ? {
            ...product,
            collectionIds: product.collectionIds.filter((cid) => cid !== id),
          }
        : product,
    );
    this.flush();
  }

  async setProductCollections(
    productId: string,
    collectionIds: string[],
  ): Promise<void> {
    const snapshot = this.read();
    const unique = [...new Set(collectionIds)];
    snapshot.products = snapshot.products.map((product) =>
      product.id === productId
        ? { ...product, collectionIds: unique, updatedAt: new Date().toISOString() }
        : product,
    );
    for (const collection of snapshot.collections) {
      const shouldHave = unique.includes(collection.id);
      const has = collection.productIds.includes(productId);
      if (shouldHave && !has) {
        collection.productIds = [productId, ...collection.productIds];
      } else if (!shouldHave && has) {
        collection.productIds = collection.productIds.filter(
          (id) => id !== productId,
        );
      }
    }
    this.flush();
  }
}
