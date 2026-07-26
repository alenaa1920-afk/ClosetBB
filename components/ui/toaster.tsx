"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/store/use-theme";

/** Sonner, dressed for the house. */
export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-center"
      offset={24}
      duration={3200}
      gap={10}
      icons={{
        success: <span className="text-base leading-none text-accent">♥</span>,
        error: <span className="text-base leading-none text-accent">✕</span>,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border-line !bg-card/85 !backdrop-blur-xl !shadow-soft !font-sans !text-ink !text-[0.9rem] !px-5 !py-4 !gap-3",
          title: "!font-medium !tracking-[-0.01em]",
          description: "!text-muted !text-[0.82rem] !mt-0.5",
          actionButton:
            "!rounded-full !bg-accent !text-white !text-[0.78rem] !px-3.5 !py-1.5 !font-medium",
          cancelButton:
            "!rounded-full !bg-petal/60 !text-ink !text-[0.78rem] !px-3.5 !py-1.5",
        },
      }}
    />
  );
}
