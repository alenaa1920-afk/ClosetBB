"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/domain/format";
import type { Collection } from "@/lib/domain/product";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import { PRODUCT_DRAG_TYPE } from "@/features/wardrobe/product-card";
import { CollectionDialog } from "./collection-dialog";

/**
 * Collections as a rail of drop targets: drag a card up here to file it.
 * On a phone, the same membership lives in each piece's detail sheet.
 */
export function CollectionsRail() {
  const collections = useWardrobeStore((state) => state.collections);
  const products = useWardrobeStore((state) => state.products);
  const activeId = useWardrobeStore((state) => state.filters.collectionId);
  const setFilters = useWardrobeStore((state) => state.setFilters);
  const addToCollection = useWardrobeStore((state) => state.addToCollection);
  const removeCollection = useWardrobeStore((state) => state.removeCollection);

  // Kept mounted so the sheet can animate itself out; `editing` lingers
  // through the exit and is replaced on the next open.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(collection: Collection) {
    setEditing(collection);
    setDialogOpen(true);
  }

  const counts = new Map<string, number>();
  for (const product of products) {
    for (const id of product.collectionIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return (
    <section aria-labelledby="collections" className="relative">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="mb-2 text-[0.66rem] font-medium tracking-[0.22em] text-accent uppercase">
            Collections
          </p>
          <h2
            id="collections"
            className="font-display text-[1.5rem] leading-tight tracking-[-0.015em] text-ink sm:text-[1.75rem]"
          >
            Occasions
          </h2>
        </div>
        <p className="hidden max-w-[16rem] pb-1 text-right text-[0.74rem] leading-relaxed text-muted lg:block">
          Drag any piece onto a collection to file it there.
        </p>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {collections.map((collection, index) => {
          const count = counts.get(collection.id) ?? 0;
          const active = activeId === collection.id;
          const isDropTarget = hovered === collection.id;

          return (
            <motion.div
              key={collection.id}
              className="group/collection relative shrink-0"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: Math.min(index, 8) * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <motion.button
                type="button"
                onClick={() =>
                  setFilters({ collectionId: active ? null : collection.id })
                }
                aria-pressed={active}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(PRODUCT_DRAG_TYPE)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    setHovered(collection.id);
                  }
                }}
                onDragLeave={() => setHovered(null)}
                onDrop={(event) => {
                  const productId = event.dataTransfer.getData(PRODUCT_DRAG_TYPE);
                  setHovered(null);
                  if (!productId) return;
                  event.preventDefault();
                  void addToCollection(productId, collection.id);
                }}
                className={cn(
                  "flex h-[4.75rem] min-w-[10.5rem] items-center gap-3 rounded-md border px-4 text-left",
                  "backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  active
                    ? "border-accent/40 bg-petal/70 shadow-veil"
                    : "border-line bg-card/70 hover:bg-card/90",
                  isDropTarget &&
                    "border-accent bg-petal/80 shadow-lift ring-2 ring-accent/30",
                )}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.1rem]",
                    active ? "bg-card/70" : "bg-petal/50",
                  )}
                >
                  {collection.emoji ?? "♥"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[1rem] text-ink">
                    {collection.name}
                  </span>
                  <span className="mt-0.5 block text-[0.72rem] tabular-nums text-muted">
                    {count === 0
                      ? "Empty"
                      : `${count} ${count === 1 ? "piece" : "pieces"}`}
                  </span>
                </span>
              </motion.button>

              {/* Quiet controls, only on hover or focus */}
              <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 transition-opacity duration-300 group-hover/collection:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Rename ${collection.name}`}
                  onClick={() => openEdit(collection)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-muted shadow-veil transition-colors duration-300 hover:text-ink"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${collection.name}`}
                  onClick={async () => {
                    await removeCollection(collection.id);
                    toast.success(`${collection.name} removed`, {
                      description: "The pieces themselves are untouched.",
                    });
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-muted shadow-veil transition-colors duration-300 hover:text-accent"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.9} />
                </button>
              </div>
            </motion.div>
          );
        })}

        <motion.button
          type="button"
          onClick={openCreate}
          className={cn(
            "flex h-[4.75rem] min-w-[10.5rem] shrink-0 items-center gap-3 rounded-md px-4 text-left",
            "border border-dashed border-accent/30 bg-card/35 text-muted backdrop-blur-xl",
            "transition-colors duration-500 hover:border-accent/50 hover:bg-petal/40 hover:text-ink",
          )}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-petal/50 text-accent"
          >
            <FolderPlus className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="font-display text-[1rem]">New collection</span>
        </motion.button>
      </div>

      <CollectionDialog
        open={dialogOpen}
        collection={editing}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  );
}
