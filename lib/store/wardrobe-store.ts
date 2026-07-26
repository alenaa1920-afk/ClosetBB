"use client";

import { create } from "zustand";
import { toast } from "sonner";
import {
  EMPTY_FILTERS,
  type Collection,
  type Filters,
  type Product,
  type ProductDraft,
} from "@/lib/domain/product";
import { resolveRepository, type WardrobeRepository } from "@/lib/data";
import { useSettingsStore } from "./settings-store";

type Status = "idle" | "loading" | "ready" | "error" | "signed-out";

interface WardrobeState {
  status: Status;
  error: string | null;
  mode: "supabase" | "atelier" | null;
  userId: string;
  /** When the wardrobe last came down from storage. */
  lastSyncedAt: string | null;

  products: Product[];
  collections: Collection[];
  filters: Filters;

  /** Product open in the detail sheet. */
  activeProductId: string | null;
  /** Bumped to fire confetti. */
  celebrate: number;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;

  addProduct: (draft: ProductDraft) => Promise<Product | null>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  toggleFavorite: (id: string, favorite: boolean) => Promise<void>;

  createCollection: (
    name: string,
    emoji?: string | null,
  ) => Promise<Collection | null>;
  updateCollection: (
    id: string,
    patch: { name?: string; emoji?: string | null },
  ) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  setProductCollections: (
    productId: string,
    collectionIds: string[],
  ) => Promise<void>;
  addToCollection: (productId: string, collectionId: string) => Promise<void>;

  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  openProduct: (id: string | null) => void;
}

/** Held outside the store: it is machinery, not state to render. */
let repository: WardrobeRepository | null = null;

function describe(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  status: "idle",
  error: null,
  mode: null,
  userId: "",
  lastSyncedAt: null,

  products: [],
  collections: [],
  filters: EMPTY_FILTERS,

  activeProductId: null,
  celebrate: 0,

  async hydrate() {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });

    try {
      const resolution = await resolveRepository();
      if (!resolution.ok) {
        set({ status: "signed-out", mode: null });
        return;
      }
      repository = resolution.repository;
      const snapshot = await repository.load();
      set({
        status: "ready",
        mode: repository.kind,
        userId: snapshot.userId,
        products: snapshot.products,
        collections: snapshot.collections,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        status: "error",
        error: describe(error, "The wardrobe would not open"),
      });
    }
  },

  async refresh() {
    if (!repository) return get().hydrate();
    try {
      const snapshot = await repository.load();
      set({
        products: snapshot.products,
        collections: snapshot.collections,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(describe(error, "Could not refresh the wardrobe"));
    }
  },

  async addProduct(draft) {
    if (!repository) return null;
    const isFirst = get().products.length === 0;

    try {
      const product = await repository.addProduct(draft);
      set((state) => ({
        // A re-saved link comes back with the same id; replace rather than duplicate.
        products: [
          product,
          ...state.products.filter((existing) => existing.id !== product.id),
        ],
        collections: state.collections.map((collection) =>
          product.collectionIds.includes(collection.id) &&
          !collection.productIds.includes(product.id)
            ? { ...collection, productIds: [product.id, ...collection.productIds] }
            : collection,
        ),
      }));

      const { hasCelebrated, markCelebrated } = useSettingsStore.getState();
      if (isFirst && !hasCelebrated) {
        markCelebrated();
        set((state) => ({ celebrate: state.celebrate + 1 }));
      }

      return product;
    } catch (error) {
      toast.error(describe(error, "Could not save this piece"));
      return null;
    }
  },

  async updateProduct(id, patch) {
    if (!repository) return;
    const previous = get().products;
    // Optimistic: the interface must never wait on the network.
    set({
      products: previous.map((product) =>
        product.id === id
          ? { ...product, ...patch, updatedAt: new Date().toISOString() }
          : product,
      ),
    });

    try {
      const saved = await repository.updateProduct(id, patch);
      set((state) => ({
        products: state.products.map((product) =>
          product.id === id ? saved : product,
        ),
      }));
    } catch (error) {
      set({ products: previous });
      toast.error(describe(error, "That change did not save"));
    }
  },

  async removeProduct(id) {
    if (!repository) return;
    const previousProducts = get().products;
    const previousCollections = get().collections;

    set({
      products: previousProducts.filter((product) => product.id !== id),
      collections: previousCollections.map((collection) => ({
        ...collection,
        productIds: collection.productIds.filter((pid) => pid !== id),
      })),
      activeProductId: null,
    });

    try {
      await repository.removeProduct(id);
    } catch (error) {
      set({ products: previousProducts, collections: previousCollections });
      toast.error(describe(error, "Could not remove this piece"));
    }
  },

  async toggleFavorite(id, favorite) {
    if (!repository) return;
    const previous = get().products;
    set({
      products: previous.map((product) =>
        product.id === id ? { ...product, favorite } : product,
      ),
    });

    try {
      await repository.setFavorite(id, favorite);
    } catch (error) {
      set({ products: previous });
      toast.error(describe(error, "Could not save the favourite"));
    }
  },

  async createCollection(name, emoji) {
    if (!repository) return null;
    try {
      const collection = await repository.createCollection(name, emoji);
      set((state) => ({ collections: [...state.collections, collection] }));
      return collection;
    } catch (error) {
      toast.error(describe(error, "Could not create that collection"));
      return null;
    }
  },

  async updateCollection(id, patch) {
    if (!repository) return;
    const previous = get().collections;
    set({
      collections: previous.map((collection) =>
        collection.id === id
          ? {
              ...collection,
              name: patch.name?.trim() || collection.name,
              emoji: patch.emoji === undefined ? collection.emoji : patch.emoji,
            }
          : collection,
      ),
    });

    try {
      const saved = await repository.updateCollection(id, patch);
      set((state) => ({
        collections: state.collections.map((collection) =>
          collection.id === id ? saved : collection,
        ),
      }));
    } catch (error) {
      set({ collections: previous });
      toast.error(describe(error, "Could not rename that collection"));
    }
  },

  async removeCollection(id) {
    if (!repository) return;
    const previousCollections = get().collections;
    const previousProducts = get().products;

    set((state) => ({
      collections: previousCollections.filter((collection) => collection.id !== id),
      products: previousProducts.map((product) => ({
        ...product,
        collectionIds: product.collectionIds.filter((cid) => cid !== id),
      })),
      filters:
        state.filters.collectionId === id
          ? { ...state.filters, collectionId: null }
          : state.filters,
    }));

    try {
      await repository.removeCollection(id);
    } catch (error) {
      set({ collections: previousCollections, products: previousProducts });
      toast.error(describe(error, "Could not remove that collection"));
    }
  },

  async setProductCollections(productId, collectionIds) {
    if (!repository) return;
    const unique = [...new Set(collectionIds)];
    const previousProducts = get().products;
    const previousCollections = get().collections;

    set({
      products: previousProducts.map((product) =>
        product.id === productId ? { ...product, collectionIds: unique } : product,
      ),
      collections: previousCollections.map((collection) => {
        const shouldHave = unique.includes(collection.id);
        const has = collection.productIds.includes(productId);
        if (shouldHave === has) return collection;
        return {
          ...collection,
          productIds: shouldHave
            ? [productId, ...collection.productIds]
            : collection.productIds.filter((id) => id !== productId),
        };
      }),
    });

    try {
      await repository.setProductCollections(productId, unique);
    } catch (error) {
      set({ products: previousProducts, collections: previousCollections });
      toast.error(describe(error, "Could not update collections"));
    }
  },

  async addToCollection(productId, collectionId) {
    const product = get().products.find((item) => item.id === productId);
    const collection = get().collections.find((item) => item.id === collectionId);
    if (!product || !collection) return;

    if (product.collectionIds.includes(collectionId)) {
      toast(`Already in ${collection.name}`);
      return;
    }

    await get().setProductCollections(productId, [
      ...product.collectionIds,
      collectionId,
    ]);
    toast.success(`Added to ${collection.name}`, { description: product.title });
  },

  setFilters(patch) {
    set((state) => ({ filters: { ...state.filters, ...patch } }));
  },

  resetFilters() {
    set((state) => ({ filters: { ...EMPTY_FILTERS, sort: state.filters.sort } }));
  },

  openProduct(id) {
    set({ activeProductId: id });
  },
}));
