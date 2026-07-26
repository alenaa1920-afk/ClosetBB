"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, TrendingDown } from "lucide-react";
import { categoryLabel } from "@/lib/domain/categories";
import { cn, formatPrice } from "@/lib/domain/format";
import { discountPercent, priceDrop, type Product } from "@/lib/domain/product";
import { HeartButton } from "@/components/ui/heart-button";
import { StoreBadge } from "@/components/ui/store-badge";
import { ProductImage, ratioFor } from "./product-image";

export const PRODUCT_DRAG_TYPE = "application/x-mon-amour-product";

interface ProductCardProps {
  product: Product;
  index: number;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  priority?: boolean;
}

function ProductCardBase({
  product,
  index,
  onOpen,
  onToggleFavorite,
  priority = false,
}: ProductCardProps) {
  const reduced = useReducedMotion();
  const discount = discountPercent(product);
  const drop = priceDrop(product);
  const ratio = ratioFor(product.id);

  return (
    <motion.article
      className="masonry-item group relative"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.72,
        // Stagger only within the first screenful; later cards arrive at once.
        delay: Math.min(index, 8) * 0.055,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduced ? undefined : { y: -6 }}
      /* Drag a piece onto a collection in the rail above. */
      draggable
      onDragStart={(event) => {
        const transfer = (event as unknown as React.DragEvent).dataTransfer;
        transfer?.setData(PRODUCT_DRAG_TYPE, product.id);
        transfer?.setData("text/plain", product.title);
        if (transfer) transfer.effectAllowed = "copy";
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${product.title}`}
        onClick={() => onOpen(product.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(product.id);
          }
        }}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-lg border border-line bg-card/80 backdrop-blur-xl",
          "shadow-veil transition-shadow duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover:shadow-lift",
        )}
      >
        <div className="relative overflow-hidden">
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            ratio={ratio}
            priority={priority}
          />

          {/* Top row — house on the left, heart on the right */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
            <StoreBadge store={product.store} />
            <div className="pointer-events-auto">
              <HeartButton
                active={product.favorite}
                onToggle={(next) => onToggleFavorite(product.id, next)}
                label={`Favourite ${product.title}`}
              />
            </div>
          </div>

          {/* Discount and price-drop flags */}
          <div className="pointer-events-none absolute bottom-3.5 left-3.5 flex flex-wrap items-center gap-2">
            {discount ? (
              <span className="rounded-full border border-white/25 bg-ink/55 px-2.5 py-[0.2rem] text-[0.65rem] font-medium tracking-[0.05em] text-white backdrop-blur-md">
                {discount}% off
              </span>
            ) : null}
            {drop ? (
              <motion.span
                className="inline-flex items-center gap-1 rounded-full border border-good/30 bg-good/15 px-2.5 py-[0.2rem] text-[0.65rem] font-medium tracking-[0.04em] text-good backdrop-blur-md"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <TrendingDown className="h-3 w-3" strokeWidth={2.2} />
                Price dropped!
              </motion.span>
            ) : null}
          </div>

          {/* Open product — slides up out of the frame on hover */}
          {product.productUrl ? (
            <div className="absolute inset-x-3.5 bottom-3.5 flex justify-end">
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-card/85 px-3.5 py-1.5",
                  "text-[0.72rem] font-medium text-ink backdrop-blur-xl shadow-veil",
                  "translate-y-3 opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                Open product
              </a>
            </div>
          ) : null}
        </div>

        <div className="space-y-2.5 px-5 pt-4 pb-5">
          <p className="text-[0.66rem] font-medium tracking-[0.2em] text-muted uppercase">
            {categoryLabel(product.category)}
          </p>

          <h3 className="font-display text-[1.08rem] leading-snug tracking-[-0.01em] text-ink">
            {product.title}
          </h3>

          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[1rem] font-medium tabular-nums text-ink">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.originalPrice != null &&
            product.price != null &&
            product.originalPrice > product.price ? (
              <span className="text-[0.8rem] tabular-nums text-muted line-through decoration-muted/50">
                {formatPrice(product.originalPrice, product.currency)}
              </span>
            ) : null}
            {product.brand ? (
              <span className="ml-auto truncate text-[0.74rem] text-muted">
                {product.brand}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export const ProductCard = memo(ProductCardBase);
