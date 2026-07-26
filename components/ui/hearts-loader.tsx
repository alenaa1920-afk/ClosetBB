import { cn } from "@/lib/domain/format";

const HEARTS = [
  { delay: "0s", size: 12, dx: "3px", opacity: 1 },
  { delay: "0.22s", size: 9, dx: "-4px", opacity: 0.85 },
  { delay: "0.44s", size: 14, dx: "2px", opacity: 1 },
  { delay: "0.66s", size: 8, dx: "5px", opacity: 0.7 },
  { delay: "0.88s", size: 11, dx: "-2px", opacity: 0.9 },
];

/**
 * The house loader: tiny hearts lifting one after another. There is no spinner
 * anywhere in Mon Amour.
 */
export function HeartsLoader({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4", className)}
    >
      <div className="flex items-end gap-1.5">
        {HEARTS.map((heart, index) => (
          <span
            key={index}
            aria-hidden
            className="block opacity-0 [animation-duration:1.8s] [animation-iteration-count:infinite] [animation-name:heart-rise] [animation-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:opacity-70"
            style={{
              animationDelay: heart.delay,
              ["--heart-dx" as string]: heart.dx,
              width: heart.size,
              height: heart.size,
              opacity: heart.opacity,
            }}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
              <path
                d="M12 20.5s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.7a4.5 4.5 0 0 1 7.5 2.8c0 5.3-7.5 10-7.5 10Z"
                fill="var(--primary)"
              />
            </svg>
          </span>
        ))}
      </div>
      {label ? (
        <p className="font-display text-[0.95rem] tracking-[0.01em] text-muted italic">
          {label}
        </p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

/** Card-shaped placeholder used while the wardrobe streams in. */
export function ProductSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="masonry-item overflow-hidden rounded-lg border border-line bg-card/70 shadow-veil">
      <div className={cn("shimmer w-full", tall ? "h-96" : "h-72")} />
      <div className="space-y-3 p-5">
        <div className="shimmer h-3 w-20 rounded-full" />
        <div className="shimmer h-4 w-4/5 rounded-full" />
        <div className="shimmer h-4 w-2/5 rounded-full" />
      </div>
    </div>
  );
}
