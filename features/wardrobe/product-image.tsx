"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/domain/format";

/** Deterministic aspect ratio per piece, so the masonry reads like a board. */
const RATIOS = ["4 / 5", "3 / 4", "1 / 1", "5 / 6", "9 / 11"] as const;

export function ratioFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return RATIOS[Math.abs(hash) % RATIOS.length];
}

const SIZES =
  "(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw";

/**
 * The original product photograph, large and rounded, zooming gently when its
 * card is hovered. Falls back to a monogram plate when a shop gave us nothing.
 */
export function ProductImage({
  src,
  alt,
  ratio,
  priority = false,
  className,
}: {
  src: string | null;
  alt: string;
  ratio: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  // Our own atelier plates are SVG; Next declines to optimise those.
  const unoptimized = Boolean(src?.toLowerCase().endsWith(".svg"));

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-petal/35", className)}
      style={{ aspectRatio: ratio }}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={SIZES}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          unoptimized={unoptimized}
          onError={() => setFailed(true)}
          className={cn(
            "object-cover",
            "transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            "group-hover:scale-[1.06]",
          )}
        />
      ) : (
        <Monogram alt={alt} />
      )}

      {/* A whisper of shade so white type stays legible over pale photographs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(31,41,55,0.32),transparent_38%,transparent_72%,rgba(31,41,55,0.14))] opacity-70 transition-opacity duration-700 group-hover:opacity-95"
      />
    </div>
  );
}

function Monogram({ alt }: { alt: string }) {
  const initial = alt.trim().charAt(0).toUpperCase() || "♥";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(140deg,var(--petal),color-mix(in_oklab,var(--surface)_70%,var(--petal)))]">
      <span className="font-display text-[4rem] leading-none text-accent/35 select-none">
        {initial}
      </span>
    </div>
  );
}
