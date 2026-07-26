"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PIECES = 44;

/** Deterministic spray, so it looks composed rather than random. */
const CONFETTI = Array.from({ length: PIECES }, (_, i) => {
  const angle = (i / PIECES) * Math.PI * 2;
  const spread = 180 + ((i * 37) % 220);
  const isHeart = i % 3 === 0;
  return {
    x: Math.cos(angle) * spread,
    y: Math.sin(angle) * spread * 0.72 - 90,
    rotate: ((i * 53) % 180) - 90,
    size: isHeart ? 11 + (i % 4) * 2 : 6 + (i % 3) * 2,
    isHeart,
    delay: (i % 8) * 0.028,
    hue: i % 4,
  };
});

const HUES = ["var(--primary)", "var(--accent)", "var(--petal)", "var(--gold)"];

/**
 * Fires once when `fire` flips to a new truthy key. Used the first time a
 * product is ever saved to the wardrobe.
 */
export function Confetti({ fire }: { fire: number }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!fire || reduced) return;
    setActive(true);
    const timer = setTimeout(() => setActive(false), 2400);
    return () => clearTimeout(timer);
  }, [fire, reduced]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {active && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center overflow-hidden"
        >
          {CONFETTI.map((piece, index) => (
            <motion.span
              key={`${fire}-${index}`}
              className="absolute"
              style={{ width: piece.size, height: piece.size }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: piece.x,
                y: [0, piece.y, piece.y + 260],
                scale: [0.3, 1, 0.9, 0.7],
                rotate: piece.rotate,
              }}
              transition={{
                duration: 2.1,
                delay: piece.delay,
                ease: [0.22, 1, 0.36, 1],
                times: [0, 0.18, 0.6, 1],
              }}
            >
              {piece.isHeart ? (
                <svg viewBox="0 0 24 24" width="100%" height="100%">
                  <path
                    d="M12 20.5s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.7a4.5 4.5 0 0 1 7.5 2.8c0 5.3-7.5 10-7.5 10Z"
                    fill={HUES[piece.hue]}
                  />
                </svg>
              ) : (
                <span
                  className="block h-full w-full rounded-full"
                  style={{ background: HUES[piece.hue] }}
                />
              )}
            </motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
