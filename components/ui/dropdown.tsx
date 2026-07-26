"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/domain/format";

export interface DropdownProps {
  label: string;
  /** What the trigger reads when closed — "All stores", "2 selected". */
  summary?: string;
  /** Highlights the trigger when a selection is live. */
  active?: boolean;
  align?: "start" | "end";
  panelClassName?: string;
  /** Renders a round icon trigger instead of a labelled pill. */
  icon?: React.ReactNode;
  iconOnly?: boolean;
  children: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
}

/** A quiet trigger that expands into a glass panel. Never a native select. */
export function Dropdown({
  label,
  summary,
  active = false,
  align = "start",
  panelClassName,
  icon,
  iconOnly = false,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup={iconOnly ? "menu" : "listbox"}
        aria-label={iconOnly ? label : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group inline-flex items-center rounded-full border",
          "transition-[background-color,border-color,box-shadow,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          iconOnly
            ? "h-10 w-10 justify-center"
            : "h-10 gap-2 px-4 text-[0.82rem] tracking-[-0.01em] whitespace-nowrap",
          active
            ? "border-accent/35 bg-petal/60 text-ink shadow-veil dark:bg-petal/70"
            : "border-line bg-card/60 text-muted backdrop-blur-xl hover:bg-card/85 hover:text-ink",
        )}
        whileTap={{ scale: 0.95 }}
        whileHover={{ y: -1.5 }}
        transition={{ type: "spring", stiffness: 480, damping: 24 }}
      >
        {iconOnly ? (
          icon
        ) : (
          <>
            {icon}
            <span className="text-muted/80 group-hover:text-muted">{label}</span>
            {summary ? (
              <span className="font-medium text-ink">{summary}</span>
            ) : null}
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
            </motion.span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role={iconOnly ? "menu" : "listbox"}
            aria-label={label}
            className={cn(
              "glass absolute z-50 mt-2 max-h-[22rem] min-w-[13rem] overflow-y-auto rounded-md p-2",
              align === "end" ? "right-0" : "left-0",
              panelClassName,
            )}
            initial={{ opacity: 0, y: -8, scaleY: 0.9, scaleX: 0.98 }}
            animate={{ opacity: 1, y: 0, scaleY: 1, scaleX: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.94, scaleX: 0.99 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
          >
            {typeof children === "function" ? children({ close }) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({
  selected = false,
  onSelect,
  children,
  swatch,
  meta,
  disabled = false,
}: {
  selected?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  /** A colour dot or store dot rendered ahead of the label. */
  swatch?: React.ReactNode;
  /** Trailing count or hint. */
  meta?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xs px-3 py-2 text-left text-[0.84rem]",
        "transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-petal/55 dark:hover:bg-petal/70",
        selected ? "text-ink" : "text-muted",
      )}
    >
      {swatch}
      <span className="flex-1 truncate">{children}</span>
      {meta ? (
        <span className="text-[0.72rem] tabular-nums text-muted/70">{meta}</span>
      ) : null}
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <Check className="h-4 w-4 text-accent" strokeWidth={2.2} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}

export function DropdownFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line-warm px-2 pt-2">
      {children}
    </div>
  );
}

export function DropdownHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-[0.76rem] leading-relaxed text-muted/80">
      {children}
    </p>
  );
}
