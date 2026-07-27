"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Heart, Plus, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/domain/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import { SearchField } from "./search-field";

export const NAVBAR_HEIGHT = 72;

export function Navbar({ onAdd }: { onAdd?: () => void }) {
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);
  const mode = useWardrobeStore((state) => state.mode);
  const favoritesOnly = useWardrobeStore((state) => state.filters.favoritesOnly);
  const setFilters = useWardrobeStore((state) => state.setFilters);

  // The bar settles closer to the page once she starts scrolling.
  useMotionValueEvent(scrollY, "change", (value) => {
    setLifted((current) => (value > 24 ? true : current && value > 8));
  });

  return (
    <header className="pad-safe-top sticky top-0 z-50">
      <div
        className={cn(
          "border-b bg-card/65 backdrop-blur-2xl backdrop-saturate-150",
          "transition-[box-shadow,background-color,border-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          lifted ? "border-line-warm bg-card/85 shadow-veil" : "border-transparent",
        )}
      >
        <div
          className="mx-auto flex h-[4.5rem] max-w-[100rem] items-center gap-3 px-4 sm:gap-5 sm:px-7"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
          }}
        >
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Mon Amour — home"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))] shadow-veil">
              <Heart
                className="h-[1.05rem] w-[1.05rem] text-white"
                strokeWidth={1.6}
                style={{ fill: "rgba(255,255,255,0.92)" }}
              />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-[1.15rem] tracking-[-0.01em] text-ink">
                Mon Amour
              </span>
              <span className="mt-0.5 text-[0.58rem] font-medium tracking-[0.24em] text-muted uppercase">
                Wardrobe
              </span>
            </span>
          </Link>

          <SearchField className="mx-auto hidden w-full max-w-md sm:flex" />

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
            <FavouritesToggle
              active={favoritesOnly}
              onToggle={() => setFilters({ favoritesOnly: !favoritesOnly })}
            />
            <ThemeToggle />

            <Link href="/settings" aria-label="Settings" className="inline-flex">
              <motion.span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card/60 text-muted backdrop-blur-xl transition-colors duration-500 hover:text-ink"
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -1.5 }}
              >
                <Settings className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />
              </motion.span>
            </Link>

            <ProfileMenu mode={mode} />

            {onAdd ? (
              <Button size="md" className="hidden sm:inline-flex" onClick={onAdd}>
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Add piece
              </Button>
            ) : null}
          </div>
        </div>

        {/* Phones get the search on its own line */}
        <div className="px-4 pb-3 sm:hidden">
          <SearchField />
        </div>
      </div>
    </header>
  );
}

function FavouritesToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Show favourites only"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl",
        "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        active
          ? "border-accent/35 bg-petal/70 text-accent"
          : "border-line bg-card/60 text-muted hover:text-ink",
      )}
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -1.5 }}
    >
      <Heart
        className="h-[1.05rem] w-[1.05rem]"
        strokeWidth={1.7}
        style={{ fill: active ? "var(--accent)" : "transparent" }}
      />
    </motion.button>
  );
}

function ProfileMenu({ mode }: { mode: "supabase" | "atelier" | null }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client) return;
    let cancelled = false;
    void client.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    const client = supabaseBrowser();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.href = "/login";
  }

  return (
    <Dropdown
      iconOnly
      align="end"
      label="Profile"
      icon={<User className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />}
      panelClassName="min-w-[15rem]"
    >
      <div className="px-3 py-2.5">
        <p className="font-display text-[1.05rem] text-ink">
          {email ? "Signed in" : "Atelier mode"}
        </p>
        <p className="mt-1 truncate text-[0.78rem] text-muted">
          {email ??
            (mode === "atelier"
              ? "Kept in this browser, no account needed."
              : "Not signed in.")}
        </p>
      </div>

      <div className="mt-1 border-t border-line-warm pt-1">
        <Link
          href="/settings"
          className="block rounded-xs px-3 py-2 text-[0.84rem] text-muted transition-colors duration-300 hover:bg-petal/55 hover:text-ink"
        >
          Settings
        </Link>
        {email ? (
          <button
            type="button"
            onClick={signOut}
            className="block w-full rounded-xs px-3 py-2 text-left text-[0.84rem] text-muted transition-colors duration-300 hover:bg-petal/55 hover:text-ink"
          >
            Sign out
          </button>
        ) : null}
      </div>
    </Dropdown>
  );
}
