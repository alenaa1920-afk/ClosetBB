"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, Puzzle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { HeartsLoader } from "@/components/ui/hearts-loader";
import { Sheet } from "@/components/ui/sheet";
import { StoreBadge } from "@/components/ui/store-badge";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  categorise,
  type CategoryKey,
} from "@/lib/domain/categories";
import { cn } from "@/lib/domain/format";
import { type Product } from "@/lib/domain/product";
import {
  extensionHint,
  STORE_KEYS,
  storeFromUrl,
  storeLabel,
  type StoreKey,
} from "@/lib/domain/stores";
import { isUnfurlFailure, type UnfurlResponse } from "@/lib/domain/unfurl";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import { ProductImage } from "@/features/wardrobe/product-image";

interface Draft {
  productUrl: string;
  title: string;
  brand: string;
  store: StoreKey;
  category: CategoryKey;
  price: string;
  originalPrice: string;
  currency: string;
  size: string;
  color: string;
  quantity: string;
  imageUrl: string;
  note: string;
  favorite: boolean;
  collectionIds: string[];
}

const BLANK: Draft = {
  productUrl: "",
  title: "",
  brand: "",
  store: "other",
  category: "others",
  price: "",
  originalPrice: "",
  currency: "INR",
  size: "",
  color: "",
  quantity: "",
  imageUrl: "",
  note: "",
  favorite: false,
  collectionIds: [],
};

function fromProduct(product: Product): Draft {
  return {
    productUrl: product.productUrl ?? "",
    title: product.title,
    brand: product.brand ?? "",
    store: product.store,
    category: product.category,
    price: product.price != null ? String(product.price) : "",
    originalPrice:
      product.originalPrice != null ? String(product.originalPrice) : "",
    currency: product.currency,
    size: product.size ?? "",
    color: product.color ?? "",
    quantity: product.quantity != null ? String(product.quantity) : "",
    imageUrl: product.imageUrl ?? "",
    note: product.note ?? "",
    favorite: product.favorite,
    collectionIds: [...product.collectionIds],
  };
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * One form for both adding and editing. Pasting a link fetches the details,
 * and every fetched field stays editable afterwards.
 */
export function ProductFormSheet({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  const collections = useWardrobeStore((state) => state.collections);
  const addProduct = useWardrobeStore((state) => state.addProduct);
  const updateProduct = useWardrobeStore((state) => state.updateProduct);

  const [draft, setDraft] = useState<Draft>(BLANK);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetched, setFetched] = useState(false);
  /** Guidance shown when a shop refuses to be read from the server. */
  const [blocked, setBlocked] = useState<string | null>(null);
  /** Once she picks a drawer herself, we stop guessing. */
  const [categoryTouched, setCategoryTouched] = useState(false);

  const editing = Boolean(product);

  useEffect(() => {
    if (!open) return;
    setDraft(product ? fromProduct(product) : BLANK);
    setFetching(false);
    setSaving(false);
    setFetched(Boolean(product));
    setBlocked(null);
    setCategoryTouched(Boolean(product));
  }, [open, product]);

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function fetchDetails() {
    const url = draft.productUrl.trim();
    if (!url) return;

    setFetching(true);
    try {
      const response = await fetch("/api/unfurl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as UnfurlResponse;

      if (!response.ok || isUnfurlFailure(payload)) {
        const message = isUnfurlFailure(payload)
          ? payload.error
          : "Could not read that page";
        const shopHint = isUnfurlFailure(payload) ? payload.hint : undefined;
        // Kept on the sheet rather than only in a toast: this one explains
        // what to do next, and she needs it while filling the form in.
        setBlocked(shopHint ?? null);
        toast.error(message, { description: shopHint });
        setFetched(true);
        return;
      }
      setBlocked(null);

      setDraft((current) => ({
        ...current,
        productUrl: payload.url,
        title: payload.title ?? current.title,
        brand: payload.brand ?? current.brand,
        store: payload.store,
        category: categoryTouched ? current.category : payload.category,
        price: payload.price != null ? String(payload.price) : current.price,
        originalPrice:
          payload.originalPrice != null
            ? String(payload.originalPrice)
            : current.originalPrice,
        currency: payload.currency || current.currency,
        color: payload.color ?? current.color,
        size: payload.size ?? current.size,
        imageUrl: payload.imageUrl ?? current.imageUrl,
      }));
      setFetched(true);
      toast.success("Details found", {
        description: payload.title ?? storeLabel(payload.store),
      });
    } catch {
      const fallback = "Fill it in by hand and it will look just as good.";
      setBlocked(fallback);
      toast.error("Could not reach that shop", { description: fallback });
      setFetched(true);
    } finally {
      setFetching(false);
    }
  }

  async function save() {
    const title = draft.title.trim();
    if (!title) {
      toast.error("Give this piece a name first");
      return;
    }

    setSaving(true);
    const price = toNumber(draft.price);
    const originalPrice = toNumber(draft.originalPrice);

    const payload = {
      title,
      brand: draft.brand.trim() || null,
      store: draft.store,
      category: draft.category,
      price,
      originalPrice:
        originalPrice != null && price != null && originalPrice > price
          ? originalPrice
          : null,
      currency: draft.currency.trim().toUpperCase() || "INR",
      discount: null,
      imageUrl: draft.imageUrl.trim() || null,
      productUrl: draft.productUrl.trim() || null,
      size: draft.size.trim() || null,
      color: draft.color.trim() || null,
      quantity: toNumber(draft.quantity),
      note: draft.note.trim() || null,
      favorite: draft.favorite,
      collectionIds: draft.collectionIds,
    };

    if (product) {
      await updateProduct(product.id, payload);
      toast.success("Saved", { description: title });
    } else {
      const created = await addProduct(payload);
      if (created) {
        toast.success("Added to her wardrobe", { description: title });
      }
    }

    setSaving(false);
    onClose();
  }

  const detectedStore = draft.productUrl.trim()
    ? storeFromUrl(draft.productUrl.trim())
    : null;

  /**
   * Some shops cannot be read from the server at all. Say so the moment the
   * link is recognised, rather than after she waits for a failure.
   */
  const guidance = blocked ?? (detectedStore ? extensionHint(detectedStore) : null);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      eyebrow={editing ? "Edit" : "New piece"}
      title={editing ? draft.title || "Edit piece" : "Add something she'd love"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !draft.title.trim()}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add to wardrobe"}
          </Button>
        </>
      }
    >
      <div className="space-y-7 pb-3">
        {/* Paste a link */}
        <div className="rounded-md border border-accent/20 bg-petal/25 p-4 sm:p-5">
          <p className="mb-3 flex items-center gap-2 text-[0.68rem] font-medium tracking-[0.18em] text-accent uppercase">
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.9} />
            Paste a product link
          </p>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              value={draft.productUrl}
              onChange={(event) => patch({ productUrl: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void fetchDetails();
                }
              }}
              placeholder="https://www.myntra.com/…"
              className="flex-1"
              data-autofocus={!editing ? true : undefined}
            />
            <Button
              variant="glass"
              onClick={fetchDetails}
              disabled={fetching || !draft.productUrl.trim()}
              className="shrink-0"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              {fetching ? "Reading…" : "Fetch details"}
            </Button>
          </div>

          <AnimatePresence>
            {guidance ? (
              <motion.div
                className="mt-4 flex gap-3 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Puzzle
                  className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                  strokeWidth={1.9}
                />
                <p className="text-[0.79rem] leading-relaxed text-ink">
                  {guidance}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {detectedStore && detectedStore !== "other" ? (
            <p className="mt-3 flex items-center gap-2 text-[0.76rem] text-muted">
              Recognised
              <StoreBadge store={detectedStore} size="sm" />
            </p>
          ) : (
            <p className="mt-3 text-[0.76rem] leading-relaxed text-muted">
              Myntra, Zara, H&amp;M, Ajio, Nykaa, Urbanic, Savana — or anywhere
              else. Everything it finds stays editable.
            </p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {fetching ? (
            <motion.div
              key="loading"
              className="py-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <HeartsLoader label="Reading the boutique…" />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              className="space-y-7"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Preview + essentials */}
              <div className="grid gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="group overflow-hidden rounded-md border border-line shadow-veil">
                  <ProductImage
                    src={draft.imageUrl.trim() || null}
                    alt={draft.title || "New piece"}
                    ratio="4 / 5"
                  />
                </div>

                <div className="space-y-5">
                  <Field label="Name">
                    <Input
                      value={draft.title}
                      onChange={(event) => {
                        const title = event.target.value;
                        patch({
                          title,
                          category: categoryTouched
                            ? draft.category
                            : categorise(title, draft.brand),
                        });
                      }}
                      placeholder="Satin cowl-neck slip dress"
                      maxLength={160}
                    />
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Brand">
                      <Input
                        value={draft.brand}
                        onChange={(event) => patch({ brand: event.target.value })}
                        placeholder="Zara"
                        maxLength={80}
                      />
                    </Field>

                    <Field label="Store">
                      <Select
                        value={draft.store}
                        onChange={(event) =>
                          patch({ store: event.target.value as StoreKey })
                        }
                      >
                        {STORE_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {storeLabel(key)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Prices */}
              <div className="grid gap-5 border-t border-line-warm pt-6 sm:grid-cols-3">
                <Field label="Price">
                  <Input
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(event) => patch({ price: event.target.value })}
                    placeholder="4990"
                  />
                </Field>
                <Field
                  label="Original price"
                  hint="Optional — shows as struck through."
                >
                  <Input
                    inputMode="decimal"
                    value={draft.originalPrice}
                    onChange={(event) =>
                      patch({ originalPrice: event.target.value })
                    }
                    placeholder="6990"
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    value={draft.currency}
                    onChange={(event) => patch({ currency: event.target.value })}
                  >
                    {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Details */}
              <div className="grid gap-5 border-t border-line-warm pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Category">
                  <Select
                    value={draft.category}
                    onChange={(event) => {
                      setCategoryTouched(true);
                      patch({ category: event.target.value as CategoryKey });
                    }}
                  >
                    {CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {CATEGORIES[key]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Size">
                  <Input
                    value={draft.size}
                    onChange={(event) => patch({ size: event.target.value })}
                    placeholder="S"
                    maxLength={24}
                  />
                </Field>
                <Field label="Colour">
                  <Input
                    value={draft.color}
                    onChange={(event) => patch({ color: event.target.value })}
                    placeholder="Ivory"
                    maxLength={40}
                  />
                </Field>
                <Field label="Quantity">
                  <Input
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(event) => patch({ quantity: event.target.value })}
                    placeholder="1"
                  />
                </Field>
              </div>

              <Field
                label="Image URL"
                hint={
                  fetched && !draft.imageUrl
                    ? "That shop did not share a photograph — paste one here."
                    : "The original product photograph."
                }
              >
                <Input
                  type="url"
                  value={draft.imageUrl}
                  onChange={(event) => patch({ imageUrl: event.target.value })}
                  placeholder="https://…"
                />
              </Field>

              <Field
                label="A note for her"
                hint="Private, and only she will see it."
              >
                <Textarea
                  value={draft.note}
                  onChange={(event) => patch({ note: event.target.value })}
                  placeholder="For the dinner we keep postponing."
                  maxLength={280}
                />
              </Field>

              {/* Collections */}
              {collections.length ? (
                <div className="border-t border-line-warm pt-6">
                  <p className="mb-3 text-[0.7rem] font-medium tracking-[0.16em] text-muted uppercase">
                    File it under
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {collections.map((collection) => {
                      const active = draft.collectionIds.includes(collection.id);
                      return (
                        <motion.button
                          key={collection.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            patch({
                              collectionIds: active
                                ? draft.collectionIds.filter(
                                    (id) => id !== collection.id,
                                  )
                                : [...draft.collectionIds, collection.id],
                            })
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.78rem]",
                            "transition-colors duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            active
                              ? "border-accent/35 bg-petal/70 text-ink"
                              : "border-line bg-card/50 text-muted hover:bg-petal/40 hover:text-ink",
                          )}
                          whileTap={{ scale: 0.95 }}
                        >
                          {collection.emoji ? (
                            <span>{collection.emoji}</span>
                          ) : null}
                          {collection.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}
