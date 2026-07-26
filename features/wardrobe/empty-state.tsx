"use client";

import { motion } from "framer-motion";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A hanger, a heart and a few petals — drawn, not stock. */
function HangerIllustration() {
  return (
    <svg
      viewBox="0 0 220 190"
      className="h-44 w-52"
      fill="none"
      role="img"
      aria-label="An empty hanger waiting for its first piece"
    >
      <defs>
        <linearGradient id="empty-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </linearGradient>
      </defs>

      {/* Rail */}
      <path
        d="M18 26h184"
        stroke="var(--muted)"
        strokeOpacity="0.28"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Hook and hanger */}
      <motion.g
        initial={{ rotate: -7 }}
        animate={{ rotate: [-7, 6, -4, 3, 0] }}
        transition={{ duration: 4.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        style={{ transformOrigin: "110px 26px" }}
      >
        <path
          d="M110 26c0-9 8-9 8-15a8 8 0 0 0-16 0"
          stroke="url(#empty-gold)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M110 40 44 96a7 7 0 0 0 4.4 12.4h123.2A7 7 0 0 0 176 96L110 40Z"
          stroke="url(#empty-gold)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M110 40v-8"
          stroke="url(#empty-gold)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* The heart hanging where a dress would be */}
        <motion.path
          d="M110 148s-19-11.8-19-25.2a11.3 11.3 0 0 1 19-7.2 11.3 11.3 0 0 1 19 7.2c0 13.4-19 25.2-19 25.2Z"
          fill="var(--primary)"
          fillOpacity="0.22"
          stroke="var(--accent)"
          strokeWidth="2"
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "110px 131px" }}
        />
      </motion.g>

      {/* Petals */}
      {[
        { cx: 46, cy: 148, r: 4, delay: 0 },
        { cx: 176, cy: 138, r: 3, delay: 0.6 },
        { cx: 66, cy: 170, r: 2.5, delay: 1.2 },
        { cx: 156, cy: 168, r: 3.5, delay: 1.8 },
      ].map((petal, index) => (
        <motion.circle
          key={index}
          cx={petal.cx}
          cy={petal.cy}
          r={petal.r}
          fill="var(--primary)"
          initial={{ opacity: 0.15, y: 0 }}
          animate={{ opacity: [0.15, 0.6, 0.15], y: [0, -8, 0] }}
          transition={{
            duration: 5,
            delay: petal.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </svg>
  );
}

export function EmptyWardrobe({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      className="glass mx-auto flex max-w-xl flex-col items-center rounded-xl px-8 py-14 text-center sm:px-14"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <HangerIllustration />

      <h2 className="mt-6 font-display text-[1.7rem] leading-snug tracking-[-0.015em] text-ink text-balance sm:text-[2rem]">
        A beautiful wardrobe starts with your first favorite.
      </h2>
      <p className="mt-4 max-w-sm text-[0.9rem] leading-relaxed text-muted">
        Paste a link from Myntra, Zara, H&amp;M, Nykaa — anywhere at all — and it
        arrives here, photograph and price and all.
      </p>

      <div aria-hidden className="mt-8 h-px w-20 rule-gold" />

      <Button size="lg" className="mt-8" onClick={onAdd}>
        <Plus className="h-4 w-4" strokeWidth={2} />
        Add the first piece
      </Button>
    </motion.div>
  );
}

export function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      className="glass-quiet mx-auto flex max-w-md flex-col items-center rounded-lg px-8 py-12 text-center"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-petal/60">
        <SlidersHorizontal className="h-5 w-5 text-accent" strokeWidth={1.6} />
      </span>
      <h2 className="font-display text-[1.4rem] text-ink">
        Nothing matches that yet
      </h2>
      <p className="mt-3 text-[0.86rem] leading-relaxed text-muted">
        Loosen a filter and the rest of the wardrobe comes back.
      </p>
      <Button variant="glass" className="mt-6" onClick={onClear}>
        Clear filters
      </Button>
    </motion.div>
  );
}
