"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Pencil, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { categoryLabel } from "@/lib/domain/categories";
import { colorLabel, colorSwatch, swatchNeedsRing } from "@/lib/domain/colors";
import { cn, formatDate, formatPrice, formatRelative } from "@/lib/domain/format";
import {
  availabilityLabel,
  discountPercent,
  priceDrop,
  savings,
  type Collection,
  type PricePoint,
  type Product,
} from "@/lib/domain/product";
import { getStore } from "@/lib/domain/stores";
import { Button } from "@/components/ui/button";
import { HeartButton } from "@/components/ui/heart-button";
import { Sheet } from "@/components/ui/sheet";
import { StoreBadge } from "@/components/ui/store-badge";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import { ProductImage } from "./product-image";

export function ProductSheet({ onEdit }: { onEdit: (product: Product) => void }) {
  const activeId = useWardrobeStore((state) => state.activeProductId);
  const product = useWardrobeStore((state) =>
    state.products.find((item) => item.id === state.activeProductId),
  );
  const collections = useWardrobeStore((state) => state.collections);
  const openProduct = useWardrobeStore((state) => state.openProduct);
  const toggleFavorite = useWardrobeStore((state) => state.toggleFavorite);
  const removeProduct = useWardrobeStore((state) => state.removeProduct);
  const setProductCollections = useWardrobeStore(
    (state) => state.setProductCollections,
  );
  const updateProduct = useWardrobeStore((state) => state.updateProduct);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => {
    setConfirmingDelete(false);
    openProduct(null);
  };

  return (
    <Sheet
      open={Boolean(activeId && product)}
      onClose={close}
      wide
      eyebrow={product ? getStore(product.store).label : undefined}
      title={product?.title ?? ""}
      footer={
        product ? (
          <>
            <AnimatePresence mode="wait" initial={false}>
              {confirmingDelete ? (
                <motion.div
                  key="confirm"
                  className="mr-auto flex items-center gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-[0.8rem] text-muted">Remove it?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const title = product.title;
                      await removeProduct(product.id);
                      setConfirmingDelete(false);
                      toast.success("Removed", { description: title });
                    }}
                  >
                    Yes, remove
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep it
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  className="mr-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Remove
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <Button variant="glass" size="sm" onClick={() => onEdit(product)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
              Edit
            </Button>

            {product.productUrl ? (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button size="sm">
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Open product
                </Button>
              </a>
            ) : null}
          </>
        ) : null
      }
    >
      {product ? (
        <ProductDetail
          product={product}
          collections={collections}
          onToggleFavorite={(next) => toggleFavorite(product.id, next)}
          onToggleCollection={(collectionId) => {
            const has = product.collectionIds.includes(collectionId);
            const next = has
              ? product.collectionIds.filter((id) => id !== collectionId)
              : [...product.collectionIds, collectionId];
            void setProductCollections(product.id, next);
          }}
          onToggleTracking={(next) =>
            void updateProduct(product.id, { tracking: next })
          }
        />
      ) : null}
    </Sheet>
  );
}

function ProductDetail({
  product,
  collections,
  onToggleFavorite,
  onToggleCollection,
  onToggleTracking,
}: {
  product: Product;
  collections: Collection[];
  onToggleFavorite: (next: boolean) => void;
  onToggleCollection: (collectionId: string) => void;
  onToggleTracking: (next: boolean) => void;
}) {
  const discount = discountPercent(product);
  const drop = priceDrop(product);
  const saved = savings(product);
  const swatch = product.color ? colorSwatch(product.color) : null;

  return (
    <div className="grid gap-7 pb-2 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] sm:gap-8">
      <div className="group relative overflow-hidden rounded-lg border border-line shadow-veil">
        <ProductImage
          src={product.imageUrl}
          alt={product.title}
          ratio="4 / 5"
          priority
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <StoreBadge store={product.store} size="sm" />
          <div className="pointer-events-auto">
            <HeartButton
              active={product.favorite}
              onToggle={onToggleFavorite}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-7">
        {/* Price */}
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="font-display text-[2rem] leading-none tabular-nums text-ink">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.originalPrice != null &&
            product.price != null &&
            product.originalPrice > product.price ? (
              <span className="text-[1rem] tabular-nums text-muted line-through decoration-muted/50">
                {formatPrice(product.originalPrice, product.currency)}
              </span>
            ) : null}
            {discount ? (
              <span className="rounded-full border border-accent/25 bg-petal/60 px-2.5 py-[0.15rem] text-[0.7rem] font-medium text-accent">
                {discount}% off
              </span>
            ) : null}
          </div>

          {saved ? (
            <p className="mt-2 text-[0.8rem] text-muted">
              Saving {formatPrice(saved, product.currency)} on the list price.
            </p>
          ) : null}

          {drop ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-good/12 px-3 py-1.5 text-[0.78rem] font-medium text-good">
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.2} />
              Price dropped {formatPrice(drop.amount, product.currency)} from{" "}
              {formatPrice(drop.from, product.currency)}
            </p>
          ) : null}
        </div>

        {/* Facts */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line-warm pt-6 text-[0.86rem]">
          <Fact
            label="Brand"
            value={product.brand ?? getStore(product.store).label}
          />
          <Fact label="Category" value={categoryLabel(product.category)} />
          {product.size ? <Fact label="Size" value={product.size} /> : null}
          {product.color ? (
            <Fact
              label="Colour"
              value={
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3.5 rounded-full",
                      swatch && swatchNeedsRing(swatch)
                        ? "ring-1 ring-line-ink"
                        : "ring-1 ring-line",
                    )}
                    style={{ background: swatch ?? undefined }}
                  />
                  {colorLabel(product.color)}
                </span>
              }
            />
          ) : null}
          {product.quantity != null && product.quantity > 1 ? (
            <Fact label="Quantity" value={`${product.quantity} in her bag`} />
          ) : null}
          {product.seller ? <Fact label="Seller" value={product.seller} /> : null}
          {product.rating != null ? (
            <Fact
              label="Rating"
              value={
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-gold">★</span>
                  {product.rating.toFixed(1)}
                  {product.ratingCount ? (
                    <span className="text-[0.76rem] text-muted">
                      ({product.ratingCount.toLocaleString("en-IN")})
                    </span>
                  ) : null}
                </span>
              }
            />
          ) : null}
          {product.availability ? (
            <Fact
              label="Availability"
              value={
                <span
                  className={cn(
                    product.availability === "out_of_stock"
                      ? "text-accent"
                      : product.availability === "low_stock"
                        ? "text-gold"
                        : "text-good",
                  )}
                >
                  {availabilityLabel(product.availability)}
                </span>
              }
            />
          ) : null}
          {product.sku ? <Fact label="Product code" value={product.sku} /> : null}
          <Fact label="Added" value={formatRelative(product.createdAt)} />
          {product.lastCheckedAt ? (
            <Fact
              label="Price checked"
              value={formatRelative(product.lastCheckedAt)}
            />
          ) : null}
        </dl>

        {/* Every size the shop offered */}
        {product.sizesAvailable.length ? (
          <div>
            <p className="mb-3 text-[0.66rem] font-medium tracking-[0.2em] text-muted uppercase">
              Sizes offered
            </p>
            <div className="flex flex-wrap gap-2">
              {product.sizesAvailable.map((size) => {
                const chosen =
                  product.size?.trim().toLowerCase() === size.trim().toLowerCase();
                return (
                  <span
                    key={size}
                    className={cn(
                      "inline-flex min-w-[2.4rem] items-center justify-center rounded-full border px-3 py-1 text-[0.78rem]",
                      chosen
                        ? "border-accent/40 bg-petal/70 font-medium text-ink"
                        : "border-line bg-card/50 text-muted",
                    )}
                  >
                    {size}
                  </span>
                );
              })}
            </div>
            {product.size ? (
              <p className="mt-2.5 text-[0.76rem] text-muted">
                Hers is <span className="text-ink">{product.size}</span>.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* A note from me */}
        {product.note ? (
          <div className="relative rounded-md border border-gold/30 bg-gold/8 px-5 py-4">
            <p className="mb-1.5 text-[0.62rem] font-medium tracking-[0.22em] text-gold uppercase">
              A note for you
            </p>
            <p className="font-display text-[1.02rem] leading-relaxed text-ink italic">
              {product.note}
            </p>
          </div>
        ) : null}

        {/* Price history */}
        {product.priceHistory.length > 1 ? (
          <PriceHistory
            history={product.priceHistory}
            currency={product.currency}
          />
        ) : null}

        {/* Watching the price */}
        {product.productUrl ? (
          <div className="flex items-start justify-between gap-5 border-t border-line-warm pt-6">
            <div className="min-w-0">
              <p className="text-[0.86rem] text-ink">Watch the price</p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">
                Re-read every few hours. Never instant — no shop announces a change,
                so this looks again on a schedule.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={product.tracking}
              aria-label="Watch the price"
              onClick={() => onToggleTracking(!product.tracking)}
              className={cn(
                "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                product.tracking
                  ? "border-transparent bg-[linear-gradient(135deg,var(--primary),var(--accent))]"
                  : "border-line bg-muted/20",
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-veil",
                  "transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  product.tracking ? "left-[1.6rem]" : "left-[0.15rem]",
                )}
              />
            </button>
          </div>
        ) : null}

        {/* Collections */}
        {collections.length ? (
          <div>
            <p className="mb-3 text-[0.66rem] font-medium tracking-[0.2em] text-muted uppercase">
              Collections
            </p>
            <div className="flex flex-wrap gap-2">
              {collections.map((collection) => {
                const active = product.collectionIds.includes(collection.id);
                return (
                  <motion.button
                    key={collection.id}
                    type="button"
                    onClick={() => onToggleCollection(collection.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.78rem]",
                      "transition-colors duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      active
                        ? "border-accent/35 bg-petal/70 text-ink"
                        : "border-line bg-card/50 text-muted hover:bg-petal/40 hover:text-ink",
                    )}
                    whileTap={{ scale: 0.95 }}
                  >
                    {collection.emoji ? <span>{collection.emoji}</span> : null}
                    {collection.name}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
        {label}
      </dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}

/** A small line of every figure this piece has ever carried. */
function PriceHistory({
  history,
  currency,
}: {
  history: PricePoint[];
  currency: string;
}) {
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const width = 260;
  const height = 54;
  const step = history.length > 1 ? width / (history.length - 1) : 0;

  const points = history.map((point, index) => ({
    x: index * step,
    y: height - ((point.price - min) / span) * (height - 12) - 6,
  }));

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <div className="border-t border-line-warm pt-6">
      <p className="mb-3 text-[0.66rem] font-medium tracking-[0.2em] text-muted uppercase">
        Price history
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-14 w-full max-w-[18rem]"
        role="img"
        aria-label={`Price moved from ${formatPrice(prices[0], currency)} to ${formatPrice(prices[prices.length - 1], currency)}`}
      >
        <defs>
          <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#price-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 3.4 : 2.2}
            fill="var(--accent)"
          />
        ))}
      </svg>

      <ul className="mt-3 space-y-1.5">
        {[...history]
          .reverse()
          .slice(0, 4)
          .map((point, index) => (
            <li
              key={`${point.recordedAt}-${index}`}
              className="flex items-baseline justify-between gap-4 text-[0.8rem]"
            >
              <span className="tabular-nums text-ink">
                {formatPrice(point.price, currency)}
              </span>
              <span className="text-muted">{formatDate(point.recordedAt)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
