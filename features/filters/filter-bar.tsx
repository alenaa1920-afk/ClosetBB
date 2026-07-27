"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import {
  CATEGORY_KEYS,
  categoryLabel,
  type CategoryKey,
} from "@/lib/domain/categories";
import { colorLabel, colorSwatch, swatchNeedsRing } from "@/lib/domain/colors";
import { cn, pluralise } from "@/lib/domain/format";
import {
  PRICE_BANDS,
  PRICE_BAND_KEYS,
  SORTS,
  SORT_KEYS,
  activeFilterCount,
  availableColors,
  categoryCounts,
  storeCounts,
  type PriceBandKey,
  type Product,
  type SortKey,
} from "@/lib/domain/product";
import { STORE_KEYS, storeLabel, type StoreKey } from "@/lib/domain/stores";
import { Dropdown, DropdownFooter, DropdownItem } from "@/components/ui/dropdown";
import { StoreDot } from "@/components/ui/store-badge";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";

/** Sits directly beneath the navbar and stays there. */
export function FilterBar({
  products,
  resultCount,
}: {
  products: Product[];
  resultCount: number;
}) {
  const filters = useWardrobeStore((state) => state.filters);
  const setFilters = useWardrobeStore((state) => state.setFilters);
  const resetFilters = useWardrobeStore((state) => state.resetFilters);
  const collections = useWardrobeStore((state) => state.collections);

  const stores = useMemo(() => storeCounts(products), [products]);
  const categories = useMemo(() => categoryCounts(products), [products]);
  const colors = useMemo(() => availableColors(products), [products]);

  const liveCount = activeFilterCount(filters);
  const activeCollection = collections.find(
    (collection) => collection.id === filters.collectionId,
  );

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];
  }

  return (
    <div
      className="sticky z-40 -mx-4 mb-8 px-4 sm:-mx-7 sm:px-7"
      style={{ top: "calc(var(--navbar-h) + env(safe-area-inset-top, 0px))" }}
    >
      <div className="rounded-lg border border-line bg-card/70 px-3 py-3 backdrop-blur-2xl backdrop-saturate-150 shadow-veil sm:px-4">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <span className="hidden shrink-0 items-center gap-2 pr-1 pl-1 text-[0.7rem] font-medium tracking-[0.18em] text-muted uppercase lg:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
            Refine
          </span>

          {/* Store */}
          <Dropdown
            label="Store"
            active={filters.stores.length > 0}
            summary={
              filters.stores.length === 0
                ? "All"
                : filters.stores.length === 1
                  ? storeLabel(filters.stores[0])
                  : `${filters.stores.length} chosen`
            }
          >
            {STORE_KEYS.filter(
              (key) => stores[key] || filters.stores.includes(key),
            ).map((key) => (
              <DropdownItem
                key={key}
                selected={filters.stores.includes(key)}
                onSelect={() =>
                  setFilters({ stores: toggle<StoreKey>(filters.stores, key) })
                }
                swatch={<StoreDot store={key} />}
                meta={stores[key] ?? 0}
              >
                {storeLabel(key)}
              </DropdownItem>
            ))}
            <DropdownFooter>
              <button
                type="button"
                className="px-1 text-[0.76rem] text-muted transition-colors hover:text-ink"
                onClick={() => setFilters({ stores: [] })}
              >
                Clear
              </button>
              <span className="px-1 text-[0.72rem] text-muted/70">
                {pluralise(Object.keys(stores).length, "house")}
              </span>
            </DropdownFooter>
          </Dropdown>

          {/* Category */}
          <Dropdown
            label="Category"
            active={filters.categories.length > 0}
            summary={
              filters.categories.length === 0
                ? "Everything"
                : filters.categories.length === 1
                  ? categoryLabel(filters.categories[0])
                  : `${filters.categories.length} chosen`
            }
            panelClassName="min-w-[15rem]"
          >
            {CATEGORY_KEYS.map((key) => (
              <DropdownItem
                key={key}
                selected={filters.categories.includes(key)}
                disabled={!categories[key] && !filters.categories.includes(key)}
                onSelect={() =>
                  setFilters({
                    categories: toggle<CategoryKey>(filters.categories, key),
                  })
                }
                meta={categories[key]}
              >
                {categoryLabel(key)}
              </DropdownItem>
            ))}
            <DropdownFooter>
              <button
                type="button"
                className="px-1 text-[0.76rem] text-muted transition-colors hover:text-ink"
                onClick={() => setFilters({ categories: [] })}
              >
                Clear
              </button>
            </DropdownFooter>
          </Dropdown>

          {/* Price */}
          <Dropdown
            label="Price"
            active={filters.priceBands.length > 0}
            summary={
              filters.priceBands.length === 0
                ? "Any"
                : filters.priceBands.length === 1
                  ? PRICE_BANDS[filters.priceBands[0]].label
                  : `${filters.priceBands.length} bands`
            }
            panelClassName="min-w-[14rem]"
          >
            {PRICE_BAND_KEYS.map((key) => (
              <DropdownItem
                key={key}
                selected={filters.priceBands.includes(key)}
                onSelect={() =>
                  setFilters({
                    priceBands: toggle<PriceBandKey>(filters.priceBands, key),
                  })
                }
              >
                {PRICE_BANDS[key].label}
              </DropdownItem>
            ))}
            <DropdownFooter>
              <button
                type="button"
                className="px-1 text-[0.76rem] text-muted transition-colors hover:text-ink"
                onClick={() => setFilters({ priceBands: [] })}
              >
                Clear
              </button>
            </DropdownFooter>
          </Dropdown>

          {/* Colour */}
          {colors.length ? (
            <Dropdown
              label="Colour"
              active={filters.colors.length > 0}
              summary={
                filters.colors.length === 0
                  ? "All"
                  : filters.colors.length === 1
                    ? colorLabel(filters.colors[0])
                    : `${filters.colors.length} chosen`
              }
              panelClassName="min-w-[13rem]"
            >
              {colors.map((color) => {
                const swatch = colorSwatch(color);
                return (
                  <DropdownItem
                    key={color}
                    selected={filters.colors.includes(color)}
                    onSelect={() =>
                      setFilters({ colors: toggle(filters.colors, color) })
                    }
                    swatch={
                      <span
                        aria-hidden
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full",
                          swatchNeedsRing(swatch)
                            ? "ring-1 ring-line-ink"
                            : "ring-1 ring-line",
                        )}
                        style={{ background: swatch }}
                      />
                    }
                  >
                    {colorLabel(color)}
                  </DropdownItem>
                );
              })}
              <DropdownFooter>
                <button
                  type="button"
                  className="px-1 text-[0.76rem] text-muted transition-colors hover:text-ink"
                  onClick={() => setFilters({ colors: [] })}
                >
                  Clear
                </button>
              </DropdownFooter>
            </Dropdown>
          ) : null}

          {/* Sort */}
          <Dropdown
            label="Sort"
            align="end"
            active={filters.sort !== "newest"}
            summary={SORTS[filters.sort]}
            panelClassName="min-w-[14rem]"
          >
            {({ close }) =>
              SORT_KEYS.map((key) => (
                <DropdownItem
                  key={key}
                  selected={filters.sort === key}
                  onSelect={() => {
                    setFilters({ sort: key as SortKey });
                    close();
                  }}
                >
                  {SORTS[key]}
                </DropdownItem>
              ))
            }
          </Dropdown>

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
            <span className="hidden text-[0.76rem] tabular-nums text-muted sm:inline">
              {pluralise(resultCount, "piece")}
            </span>
            <AnimatePresence>
              {liveCount > 0 || filters.query ? (
                <motion.button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-petal/60 px-3 py-1.5 text-[0.76rem] text-ink transition-colors duration-400 hover:bg-petal/80"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <X className="h-3 w-3" strokeWidth={2.2} />
                  Clear
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* A collection filter shows as its own removable line */}
        <AnimatePresence>
          {activeCollection ? (
            <motion.div
              className="mt-2.5 flex items-center gap-2 border-t border-line-warm pt-2.5"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="text-[0.7rem] tracking-[0.16em] text-muted uppercase">
                Viewing
              </span>
              <button
                type="button"
                onClick={() => setFilters({ collectionId: null })}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-petal/70 px-3 py-1 text-[0.8rem] text-ink"
              >
                {activeCollection.emoji ? (
                  <span>{activeCollection.emoji}</span>
                ) : null}
                {activeCollection.name}
                <X className="h-3 w-3" strokeWidth={2.2} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
