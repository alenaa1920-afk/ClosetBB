"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/domain/format";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";

const DEBOUNCE_MS = 180;

/**
 * Instant search across name, brand, store, category, colour and size.
 * Typing is local; the wardrobe filter follows a beat later so a long list
 * never stutters under the keystroke.
 */
export function SearchField({ className }: { className?: string }) {
  const query = useWardrobeStore((state) => state.filters.query);
  const setFilters = useWardrobeStore((state) => state.setFilters);

  const [value, setValue] = useState(query);
  const [focused, setFocused] = useState(false);

  // Keep in step when something else clears the filters.
  useEffect(() => {
    setValue((current) => (current === query ? current : query));
  }, [query]);

  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => setFilters({ query: value }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, query, setFilters]);

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-full border",
        "transition-[background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        focused
          ? "border-accent/30 bg-card/95 shadow-veil"
          : "border-line bg-card/55 hover:bg-card/80",
        "backdrop-blur-xl",
        className,
      )}
    >
      <Search
        className={cn(
          "pointer-events-none absolute left-4 h-4 w-4 transition-colors duration-400",
          focused ? "text-accent" : "text-muted",
        )}
        strokeWidth={1.8}
      />

      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search her wardrobe…"
        aria-label="Search the wardrobe"
        className={cn(
          "h-11 w-full rounded-full bg-transparent pr-11 pl-11",
          "text-[0.88rem] text-ink placeholder:text-muted/70",
          "focus:outline-none",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      <AnimatePresence>
        {value ? (
          <motion.button
            type="button"
            onClick={() => {
              setValue("");
              setFilters({ query: "" });
            }}
            aria-label="Clear search"
            className="absolute right-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-300 hover:bg-petal/60 hover:text-ink"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
