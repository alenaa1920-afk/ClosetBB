"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/store/use-theme";
import { cn } from "@/lib/domain/format";

/** Sun and moon trade places on a spring. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle, mounted } = useTheme();
  const dark = mounted && resolved === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light" : "Switch to dark"}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full",
        "border border-line bg-card/60 text-muted backdrop-blur-xl",
        "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink",
        className,
      )}
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -1.5 }}
      transition={{ type: "spring", stiffness: 480, damping: 24 }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={dark ? "moon" : "sun"}
          className="inline-flex"
          initial={{ opacity: 0, rotate: -70, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 70, scale: 0.5 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {dark ? (
            <Moon className="h-[1.05rem] w-[1.05rem] text-gold" strokeWidth={1.7} />
          ) : (
            <Sun className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
