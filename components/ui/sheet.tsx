"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/domain/format";

/**
 * A centred dialog on a laptop, a bottom sheet on a phone — with a drag-to-
 * dismiss handle there. Rendered into a portal so no ancestor transform can
 * trap it.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Move focus into the sheet without stealing it from a chosen input.
    const frame = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, textarea, button",
      );
      focusable?.focus();
    });
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-90 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/25 backdrop-blur-md dark:bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "glass relative flex max-h-[92dvh] w-full flex-col overflow-hidden",
              "rounded-t-xl sm:rounded-xl",
              wide ? "sm:max-w-3xl" : "sm:max-w-lg",
            )}
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 40, scale: 0.97, filter: "blur(6px)" }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 30, scale: 0.98, filter: "blur(6px)" }
            }
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            drag={reduced ? false : "y"}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.32 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 700) onClose();
            }}
          >
            {/* Drag handle — phones only */}
            <div className="flex justify-center pt-3 sm:hidden">
              <span aria-hidden className="h-1 w-11 rounded-full bg-muted/30" />
            </div>

            <header className="flex items-start gap-4 px-6 pt-5 pb-4 sm:px-8 sm:pt-7">
              <div className="min-w-0 flex-1">
                {eyebrow ? (
                  <p className="mb-1.5 text-[0.68rem] font-medium tracking-[0.22em] text-accent uppercase">
                    {eyebrow}
                  </p>
                ) : null}
                <h2 className="font-display text-[1.6rem] leading-tight tracking-[-0.015em] text-ink">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card/60 text-muted transition-colors duration-400 hover:bg-petal/60 hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </header>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 sm:px-8"
              style={{
                // Room for the home indicator when there is no footer below.
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {children}
            </div>

            {footer ? (
              <footer
                className="flex flex-wrap items-center justify-end gap-3 border-t border-line-warm bg-card/40 px-6 py-4 sm:px-8"
                style={{
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
