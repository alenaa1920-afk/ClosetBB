import type { CSSProperties } from "react";
import { getStore, type StoreKey } from "@/lib/domain/stores";
import { cn } from "@/lib/domain/format";

/**
 * Each house wears its own colour. Houses with a gradient identity (Nykaa)
 * get the full sweep; the rest get a tinted glass chip that glows when the
 * card beneath it is hovered.
 */
export function StoreBadge({
  store,
  size = "md",
  className,
}: {
  store: StoreKey;
  size?: "sm" | "md";
  className?: string;
}) {
  const definition = getStore(store);
  const gradient = definition.gradient;

  const style = {
    ["--badge" as string]: definition.color,
    ["--badge-dark" as string]: definition.colorDark ?? definition.color,
    ...(gradient
      ? {
          backgroundImage: `linear-gradient(120deg, ${gradient[0]}, ${gradient[1]})`,
          color: "#ffffff",
          borderColor: "rgba(255,255,255,0.28)",
        }
      : null),
  } satisfies CSSProperties;

  return (
    <span
      className={cn(
        "store-badge inline-flex items-center gap-1.5 rounded-full font-medium tracking-[0.06em] uppercase backdrop-blur-md",
        size === "sm"
          ? "px-2.5 py-[0.2rem] text-[0.6rem]"
          : "px-3 py-[0.3rem] text-[0.65rem]",
        className,
      )}
      style={style}
    >
      {!gradient ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "currentColor", opacity: 0.75 }}
        />
      ) : null}
      {definition.label}
    </span>
  );
}

/** The same colour, reduced to a dot — used inside filter dropdowns. */
export function StoreDot({ store }: { store: StoreKey }) {
  const definition = getStore(store);
  return (
    <span
      aria-hidden
      className="store-swatch h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line"
      style={{
        ["--badge" as string]: definition.color,
        ["--badge-dark" as string]: definition.colorDark ?? definition.color,
        ...(definition.gradient
          ? {
              backgroundImage: `linear-gradient(120deg, ${definition.gradient[0]}, ${definition.gradient[1]})`,
            }
          : null),
      }}
    />
  );
}
