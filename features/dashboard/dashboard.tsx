"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { HeartsLoader, ProductSkeleton } from "@/components/ui/hearts-loader";
import { selectProducts, type Product } from "@/lib/domain/product";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import { Navbar } from "@/features/navigation/navbar";
import { FilterBar } from "@/features/filters/filter-bar";
import { CollectionsRail } from "@/features/collections/collections-rail";
import { ProductFormSheet } from "@/features/add-product/product-form-sheet";
import { EmptyResults, EmptyWardrobe } from "@/features/wardrobe/empty-state";
import { ProductGrid } from "@/features/wardrobe/product-grid";
import { ProductSheet } from "@/features/wardrobe/product-sheet";
import { TodaysPicks } from "@/features/wardrobe/todays-picks";
import { Hero } from "./hero";

export function Dashboard() {
  const status = useWardrobeStore((state) => state.status);
  const error = useWardrobeStore((state) => state.error);
  const mode = useWardrobeStore((state) => state.mode);
  const products = useWardrobeStore((state) => state.products);
  const filters = useWardrobeStore((state) => state.filters);
  const celebrate = useWardrobeStore((state) => state.celebrate);
  const hydrate = useWardrobeStore((state) => state.hydrate);
  const openProduct = useWardrobeStore((state) => state.openProduct);
  const toggleFavorite = useWardrobeStore((state) => state.toggleFavorite);
  const resetFilters = useWardrobeStore((state) => state.resetFilters);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const visible = useMemo(
    () => selectProducts(products, filters),
    [products, filters],
  );

  const recent = useMemo(
    () => [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [products],
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormOpen(true);
    openProduct(null);
  }

  if (status === "signed-out") {
    return <SignedOut />;
  }

  // Atelier mode is a nicety on a laptop and a trap in production: it looks
  // like a working wardrobe while saving to one browser, and the extension
  // cannot reach it at all. Say so loudly rather than let her fill it up.
  if (mode === "atelier" && process.env.NODE_ENV === "production") {
    return <NotConfigured />;
  }

  return (
    <div className="min-h-dvh">
      <Navbar onAdd={openAdd} />

      <main className="mx-auto max-w-[100rem] px-4 pt-8 pb-28 sm:px-7 sm:pb-20">
        {status === "loading" || status === "idle" ? (
          <LoadingWardrobe />
        ) : status === "error" ? (
          <ErrorState message={error} onRetry={() => void hydrate()} />
        ) : (
          <>
            <Hero products={products} mode={mode} />

            {products.length === 0 ? (
              <EmptyWardrobe onAdd={openAdd} />
            ) : (
              <>
                <div className="mb-14 space-y-14">
                  <TodaysPicks products={recent} onOpen={openProduct} />
                  <CollectionsRail />
                </div>

                <FilterBar products={products} resultCount={visible.length} />

                <AnimatePresence mode="wait">
                  {visible.length ? (
                    <motion.div
                      key="grid"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ProductGrid
                        products={visible}
                        onOpen={openProduct}
                        onToggleFavorite={toggleFavorite}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <EmptyResults onClear={resetFilters} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </main>

      {/* Phones get a floating way in */}
      <motion.button
        type="button"
        onClick={openAdd}
        aria-label="Add a piece"
        className="fixed right-5 bottom-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white shadow-lift sm:hidden"
        whileTap={{ scale: 0.92 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 24, delay: 0.4 }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.2} />
      </motion.button>

      <ProductSheet onEdit={openEdit} />
      <ProductFormSheet
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
      />
      <Confetti fire={celebrate} />
    </div>
  );
}

function LoadingWardrobe() {
  return (
    <div className="py-16">
      <HeartsLoader label="Opening her wardrobe…" />
      <div className="masonry mt-16" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <ProductSkeleton key={index} tall={index % 3 === 1} />
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="glass mx-auto mt-16 max-w-md rounded-lg px-8 py-12 text-center">
      <h2 className="font-display text-[1.5rem] text-ink">
        The wardrobe would not open
      </h2>
      <p className="mt-3 text-[0.86rem] leading-relaxed text-muted">
        {message ?? "Something went wrong on the way in."}
      </p>
      <Button className="mt-7" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * Shown when a deployed Mon Amour has no Supabase keys. Deliberately blunt:
 * the alternative is a wardrobe that quietly saves nowhere.
 */
function NotConfigured() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="glass max-w-lg rounded-xl px-8 py-12 sm:px-12">
        <p className="mb-4 text-[0.66rem] font-medium tracking-[0.3em] text-accent uppercase">
          Not connected
        </p>
        <h1 className="font-display text-[1.9rem] leading-tight tracking-[-0.02em] text-ink">
          This Mon Amour has no wardrobe behind it yet
        </h1>
        <p className="mt-4 text-[0.9rem] leading-relaxed text-muted">
          The site is live, but its database keys are missing — so nothing saved
          here would be kept, and the Chrome extension has nowhere to file anything.
        </p>

        <div className="mt-8 rounded-md border border-gold/40 bg-gold/10 px-5 py-4">
          <p className="mb-3 text-[0.8rem] font-medium text-ink">
            In your Vercel project → Settings → Environment Variables:
          </p>
          <ul className="space-y-1.5 font-mono text-[0.74rem] text-muted">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="mt-4 text-[0.78rem] leading-relaxed text-muted">
            Then <span className="text-ink">redeploy</span>. These are read when the
            site is built, not when it runs, so adding them to an existing
            deployment changes nothing until it is rebuilt.
          </p>
        </div>
      </div>
    </main>
  );
}

function SignedOut() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="glass max-w-md rounded-lg px-8 py-12 text-center">
        <h1 className="font-display text-[1.7rem] text-ink">
          This wardrobe is private
        </h1>
        <p className="mt-3 text-[0.88rem] leading-relaxed text-muted">
          Sign in and everything comes back exactly as she left it.
        </p>
        <Link href="/login" className="mt-7 inline-flex">
          <Button>Sign in</Button>
        </Link>
      </div>
    </main>
  );
}
