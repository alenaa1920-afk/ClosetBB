import { type CSSProperties } from "react";

/** Deterministic PRNG so server and client render identical particles. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Petal {
  style: CSSProperties;
}

function buildPetals(count: number, seed: number): Petal[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const size = 3 + rand() * 9;
    const duration = 15 + rand() * 15;
    return {
      style: {
        left: `${rand() * 100}%`,
        top: `${6 + rand() * 90}%`,
        width: size,
        height: size,
        // Larger motes stay fainter, so the field never reads as confetti.
        ["--petal-opacity" as string]: (0.46 - (size / 12) * 0.26).toFixed(3),
        ["--petal-dy" as string]: `${(-70 - rand() * 110).toFixed(0)}px`,
        ["--petal-dx" as string]: `${(rand() * 44 - 22).toFixed(0)}px`,
        filter: `blur(${size > 8 ? 3 : size > 5 ? 1.5 : 0.5}px)`,
        animationDuration: `${duration.toFixed(1)}s`,
        // Negative delay: every petal is already mid-flight on frame one.
        animationDelay: `${(-rand() * duration).toFixed(1)}s`,
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,.95), var(--color-primary) 55%, rgba(236,72,153,.35) 100%)",
      },
    };
  });
}

/**
 * A very subtle field of drifting pink motes. Pure CSS — no JS per frame,
 * and it survives `prefers-reduced-motion` by simply holding still.
 */
export function Particles({
  count = 24,
  seed = 20260726,
  className = "",
}: {
  count?: number;
  seed?: number;
  className?: string;
}) {
  const petals = buildPetals(count, seed);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {petals.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-0 [animation-iteration-count:infinite] [animation-name:petal-drift] [animation-timing-function:ease-in-out] motion-reduce:opacity-30"
          style={p.style}
        />
      ))}
    </div>
  );
}
