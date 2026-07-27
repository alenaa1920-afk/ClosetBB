"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn, formatPrice, formatRelative } from "@/lib/domain/format";
import type { Product } from "@/lib/domain/product";
import { StoreBadge } from "@/components/ui/store-badge";
import { ProductImage } from "./product-image";

const MAX = 10;

/** The most recent arrivals, in a rail that scrolls sideways. */
export function TodaysPicks({
  products,
  onOpen,
}: {
  products: Product[];
  onOpen: (id: string) => void;
}) {
  const picks = products.slice(0, MAX);
  if (picks.length < 3) return null;

  return (
    <motion.section
      aria-labelledby="todays-picks"
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
    >
      <div className="mb-5 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[0.66rem] font-medium tracking-[0.22em] text-accent uppercase">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            Today&rsquo;s picks
          </p>
          <h2
            id="todays-picks"
            className="font-display text-[1.5rem] leading-tight tracking-[-0.015em] text-ink sm:text-[1.75rem]"
          >
            Just arrived
          </h2>
        </div>
        <span className="hidden shrink-0 pb-1 text-[0.74rem] text-muted sm:block">
          Scroll for more →
        </span>
      </div>

      <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {picks.map((product, index) => (
          <motion.button
            key={product.id}
            type="button"
            onClick={() => onOpen(product.id)}
            className={cn(
              "group relative w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-md",
              "card-glass border border-line text-left shadow-veil",
              "transition-shadow duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-lift",
              "active:scale-[0.98] active:transition-transform active:duration-150",
              "sm:w-[12rem]",
            )}
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.12 + index * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{ y: -4 }}
          >
            <div className="relative overflow-hidden">
              <ProductImage
                src={product.imageUrl}
                alt={product.title}
                ratio="4 / 5"
              />
              <span className="pointer-events-none absolute top-2.5 left-2.5">
                <StoreBadge store={product.store} size="sm" />
              </span>
            </div>
            <div className="space-y-1.5 px-3.5 pt-3 pb-3.5">
              <p className="truncate font-display text-[0.92rem] text-ink">
                {product.title}
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.86rem] font-medium tabular-nums text-ink">
                  {formatPrice(product.price, product.currency)}
                </span>
                <span className="text-[0.68rem] text-muted">
                  {formatRelative(product.createdAt)}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
