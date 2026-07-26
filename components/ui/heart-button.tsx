"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/domain/format";

const BURST_COUNT = 8;
/** Fixed offsets so the burst is identical every time — no server/client drift. */
const BURST = Array.from({ length: BURST_COUNT }, (_, i) => {
  const angle = (i / BURST_COUNT) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * 26,
    y: Math.sin(angle) * 26,
    size: i % 2 === 0 ? 6 : 4,
  };
});

/**
 * The Instagram gesture: an overshooting fill, an expanding ring, and a short
 * burst of petals. Fires only when going from unloved to loved.
 */
export function HeartButton({
  active,
  onToggle,
  size = "md",
  label = "Favourite",
  className,
}: {
  active: boolean;
  onToggle: (next: boolean) => void;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const [burstKey, setBurstKey] = useState(0);
  const reduced = useReducedMotion();
  const id = useId();

  const iconSize = size === "sm" ? "h-4 w-4" : "h-[1.15rem] w-[1.15rem]";

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !active;
    if (next && !reduced) setBurstKey((key) => key + 1);
    onToggle(next);
  }

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${label} — on` : label}
      onClick={handleClick}
      className={cn(
        "group/heart relative inline-flex items-center justify-center rounded-full",
        "border border-line bg-card/70 backdrop-blur-xl shadow-veil",
        "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        active ? "bg-card/90" : "hover:bg-card/90",
        className,
      )}
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 520, damping: 20 }}
    >
      {/* Expanding ring */}
      <AnimatePresence>
        {burstKey > 0 && (
          <motion.span
            key={`ring-${burstKey}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
            initial={{ opacity: 0.7, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Petal burst */}
      <AnimatePresence>
        {burstKey > 0 &&
          BURST.map((petal, index) => (
            <motion.span
              key={`${id}-${burstKey}-${index}`}
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-accent"
              style={{ width: petal.size, height: petal.size }}
              initial={{ opacity: 0.95, x: 0, y: 0, scale: 0.4 }}
              animate={{ opacity: 0, x: petal.x, y: petal.y, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.62,
                delay: index * 0.012,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
      </AnimatePresence>

      <motion.span
        className="relative inline-flex"
        animate={active ? { scale: [1, 1.42, 0.92, 1.08, 1] } : { scale: 1 }}
        transition={
          active
            ? { duration: reduced ? 0.01 : 0.62, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.3 }
        }
      >
        <Heart
          className={cn(
            iconSize,
            "transition-colors duration-500",
            active ? "text-accent" : "text-muted group-hover/heart:text-accent",
          )}
          strokeWidth={active ? 1.6 : 1.7}
          style={
            active
              ? {
                  fill: "var(--accent)",
                  filter:
                    "drop-shadow(0 3px 10px color-mix(in oklab, var(--accent) 45%, transparent))",
                }
              : { fill: "transparent" }
          }
        />
      </motion.span>
    </motion.button>
  );
}
