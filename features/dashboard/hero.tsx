"use client";

import { motion } from "framer-motion";
import { formatPrice, pluralise } from "@/lib/domain/format";
import { priceDrop, type Product } from "@/lib/domain/product";
import { Particles } from "@/components/welcome/particles";

export function Hero({
  products,
  mode,
}: {
  products: Product[];
  mode: "supabase" | "atelier" | null;
}) {
  const houses = new Set(products.map((product) => product.store)).size;
  const favourites = products.filter((product) => product.favorite).length;
  const drops = products.filter((product) => priceDrop(product) !== null).length;
  const total = products.reduce((sum, product) => sum + (product.price ?? 0), 0);

  const stats = [
    { label: "Pieces", value: String(products.length) },
    { label: "Boutiques", value: String(houses) },
    { label: "Loved", value: String(favourites) },
    {
      label: drops ? "Price drops" : "Wardrobe value",
      value: drops
        ? String(drops)
        : formatPrice(total, products[0]?.currency ?? "INR"),
    },
  ];

  return (
    <section className="relative mb-12 overflow-hidden rounded-xl border border-line bg-card/55 px-6 py-10 backdrop-blur-2xl shadow-veil sm:px-10 sm:py-14">
      <Particles count={14} seed={4242} />

      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 26%, transparent), transparent 68%)",
          filter: "blur(18px)",
        }}
      />

      <div className="relative">
        <motion.p
          className="mb-4 text-[0.68rem] font-medium tracking-[0.3em] text-accent uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          Mon Amour
        </motion.p>

        <motion.h1
          className="max-w-2xl font-display text-[2.1rem] leading-[1.08] tracking-[-0.025em] text-ink text-balance sm:text-[3.1rem]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          Everything she loves,
          <br />
          <span className="italic">gathered in one place</span>
        </motion.h1>

        <motion.p
          className="mt-5 max-w-lg text-[0.92rem] leading-relaxed text-muted"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {products.length
            ? `${pluralise(products.length, "piece")} from ${pluralise(houses, "boutique")}, kept the way a wardrobe should be kept.`
            : "Paste a link from any boutique and it arrives here — photograph, price and all."}
        </motion.p>

        {products.length ? (
          <motion.dl
            className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="mb-1.5 text-[0.62rem] font-medium tracking-[0.2em] text-muted uppercase">
                  {stat.label}
                </dt>
                <dd className="font-display text-[1.55rem] leading-none tabular-nums text-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        ) : null}

        {mode === "atelier" ? (
          <motion.p
            className="mt-9 inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[0.76rem] text-ink"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
            Atelier mode — kept in this browser. Add Supabase keys to sync
            everywhere.
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}
