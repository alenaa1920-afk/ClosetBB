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
  /**
   * Three stages, because a shop's photograph can fail for reasons that have
   * nothing to do with the URL being wrong.
   *
   *   optimised — through Next's image optimiser, resized and re-encoded
   *   direct    — straight from the shop, loaded by her own browser
   *   gone      — nothing loads; show the monogram
   *
   * The middle stage matters: the optimiser fetches from a server, and some
   * retailers' CDNs refuse datacentre traffic while happily serving the same
   * image to a browser. Falling back means the picture still appears.
   */
  const [stage, setStage] = useState<"optimised" | "direct" | "gone">("optimised");

  // Reset when the piece changes, or a previous failure sticks to the new one.
  const [seen, setSeen] = useState(src);
  if (seen !== src) {
    setSeen(src);
    setStage("optimised");
  }

  // Our own atelier plates are SVG; Next declines to optimise those.
  const unoptimized = Boolean(src?.toLowerCase().endsWith(".svg"));
  const imageClasses = cn(
    "object-cover",
    "transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
    "group-hover:scale-[1.06]",
  );

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-petal/35", className)}
      style={{ aspectRatio: ratio }}
    >
      {!src || stage === "gone" ? (
        <Monogram alt={alt} />
      ) : stage === "optimised" ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={SIZES}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          unoptimized={unoptimized}
          onError={() => setStage("direct")}
          className={imageClasses}
        />
      ) : (
        /* Deliberate: the un-optimised escape hatch for CDNs that refuse the
           optimiser. next/image is precisely what just failed here. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setStage("gone")}
          className={cn(imageClasses, "absolute inset-0 h-full w-full")}
        />
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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(140deg,var(--petal),color-mix(in_oklab,var(--surface)_70%,var(--petal)))]">
      <span className="font-display text-[3.4rem] leading-none text-accent/35 select-none">
        {initial}
      </span>
      {/* Say it plainly. A bare initial reads as "broken" rather than
          "this shop gave us no photograph". */}
      <span className="px-4 text-center text-[0.62rem] font-medium tracking-[0.14em] text-muted/70 uppercase">
        No photograph
      </span>
    </div>
  );
}
