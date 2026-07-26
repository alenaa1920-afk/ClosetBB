"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/domain/format";

const CONTROL = cn(
  "w-full rounded-sm border border-line bg-card/70 px-4 py-3",
  "text-[0.9rem] text-ink placeholder:text-muted/60",
  "shadow-inner-veil backdrop-blur-xl",
  "transition-[border-color,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
  "hover:bg-card/85 focus:border-accent/40 focus:bg-card/95 focus:outline-none",
);

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-[0.7rem] font-medium tracking-[0.16em] text-muted uppercase">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[0.74rem] leading-relaxed text-muted/80">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={props.rows ?? 3}
      className={cn(CONTROL, "resize-none leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(CONTROL, "appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
      >
        <svg width="11" height="7" viewBox="0 0 11 7" fill="none">
          <path
            d="M1 1l4.5 4.5L10 1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
});

/** A pill-shaped switch used across Settings. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.9rem] font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked
            ? "border-transparent bg-[linear-gradient(135deg,var(--primary),var(--accent))]"
            : "border-line bg-muted/20",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-veil",
            "transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "left-[1.6rem]" : "left-[0.15rem]",
          )}
        />
      </button>
    </div>
  );
}
