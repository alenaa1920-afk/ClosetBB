"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/domain/product";
import { ProductCard } from "./product-card";

/** How many pieces mount at once. Beyond this we render on approach. */
const CHUNK = 60;

/**
 * The board. Pinterest-style CSS masonry, rendered in chunks so a wardrobe of
 * several thousand pieces still opens instantly — only what is near the
 * viewport is ever in the DOM.
 */
export function ProductGrid({
  products,
  onOpen,
  onToggleFavorite,
}: {
  products: Product[];
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
}) {
  const [limit, setLimit] = useState(CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // A new result set always starts from the top.
  const signature = products.length ? `${products.length}:${products[0].id}` : "0";
  useEffect(() => {
    setLimit(CHUNK);
  }, [signature]);

  const visible = useMemo(() => products.slice(0, limit), [products, limit]);
  const hasMore = limit < products.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => Math.min(current + CHUNK, products.length));
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  return (
    <>
      <div className="masonry">
        {visible.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            onOpen={onOpen}
            onToggleFavorite={onToggleFavorite}
            priority={index < 4}
          />
        ))}
      </div>

      {hasMore ? <div ref={sentinelRef} className="h-24" aria-hidden /> : null}
    </>
  );
}
