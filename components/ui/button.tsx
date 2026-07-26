"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/domain/format";

export type ButtonVariant = "primary" | "glass" | "ghost" | "gold" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "text-white border border-white/25 shadow-soft bg-[linear-gradient(135deg,var(--primary),var(--accent))] hover:brightness-[1.06]",
  glass:
    "glass-quiet text-ink hover:bg-petal/45 hover:border-line-warm dark:hover:bg-petal/60",
  ghost: "text-muted hover:text-ink hover:bg-petal/50",
  gold: "text-ink border border-gold/45 bg-gold/10 hover:bg-gold/20",
  danger:
    "text-white border border-white/20 bg-[linear-gradient(135deg,#f87171,#e11d48)] hover:brightness-[1.06]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.8rem] gap-1.5 rounded-full",
  md: "h-11 px-5 text-[0.875rem] gap-2 rounded-full",
  lg: "h-13 px-7 text-[0.95rem] gap-2.5 rounded-full",
  icon: "h-11 w-11 rounded-full",
  "icon-sm": "h-9 w-9 rounded-full",
};

/** Shared so anchors and labels can wear the same clothes as a button. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "relative inline-flex select-none items-center justify-center font-medium tracking-[-0.01em]",
    "transition-[background-color,box-shadow,color,filter,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "disabled:pointer-events-none disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
}

/** Every press answers with a spring. Nothing in the app snaps. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={props.type ?? "button"}
      className={buttonClasses(variant, size, className)}
      whileHover={props.disabled ? undefined : { y: -1.5, scale: 1.02 }}
      whileTap={props.disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 26, mass: 0.6 }}
      {...props}
    >
      {children}
    </motion.button>
  );
});
