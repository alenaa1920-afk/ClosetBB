"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Moon,
  Puzzle,
  RefreshCw,
  Sun,
  SunMoon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/field";
import { StoreDot } from "@/components/ui/store-badge";
import { cn, formatRelative, pluralise } from "@/lib/domain/format";
import { STORES, STORE_KEYS } from "@/lib/domain/stores";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useTheme } from "@/lib/store/use-theme";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";
import type { ThemePreference } from "@/lib/store/theme-store";

const THEMES: Array<{
  key: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    key: "light",
    label: "Light",
    icon: <Sun className="h-4 w-4" strokeWidth={1.7} />,
  },
  {
    key: "dark",
    label: "Dark",
    icon: <Moon className="h-4 w-4" strokeWidth={1.7} />,
  },
  {
    key: "system",
    label: "System",
    icon: <SunMoon className="h-4 w-4" strokeWidth={1.7} />,
  },
];

export function SettingsView() {
  const { preference, setPreference, mounted } = useTheme();
  const notifications = useSettingsStore((state) => state.notifications);
  const priceDropAlerts = useSettingsStore((state) => state.priceDropAlerts);
  const setNotifications = useSettingsStore((state) => state.setNotifications);
  const setPriceDropAlerts = useSettingsStore((state) => state.setPriceDropAlerts);

  const status = useWardrobeStore((state) => state.status);
  const mode = useWardrobeStore((state) => state.mode);
  const products = useWardrobeStore((state) => state.products);
  const collections = useWardrobeStore((state) => state.collections);
  const lastSyncedAt = useWardrobeStore((state) => state.lastSyncedAt);
  const hydrate = useWardrobeStore((state) => state.hydrate);
  const refresh = useWardrobeStore((state) => state.refresh);

  useEffect(() => {
    if (status === "idle") void hydrate();
  }, [status, hydrate]);

  const storeCounts = new Map<string, number>();
  for (const product of products) {
    storeCounts.set(product.store, (storeCounts.get(product.store) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-24 sm:px-8">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-[0.82rem] text-muted transition-colors duration-400 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Back to the wardrobe
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-3 text-[0.66rem] font-medium tracking-[0.3em] text-accent uppercase">
          Settings
        </p>
        <h1 className="font-display text-[2.2rem] leading-tight tracking-[-0.02em] text-ink sm:text-[2.6rem]">
          How it all behaves
        </h1>
        <div aria-hidden className="mt-7 h-px w-24 rule-gold" />
      </motion.header>

      <div className="mt-12 space-y-6">
        <Panel
          title="Theme"
          description="The same house, two kinds of light."
          delay={0.05}
        >
          <div className="flex flex-wrap gap-2.5">
            {THEMES.map((theme) => {
              const active = mounted && preference === theme.key;
              return (
                <motion.button
                  key={theme.key}
                  type="button"
                  onClick={() => setPreference(theme.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-sm border px-4 py-3 text-[0.85rem]",
                    "transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    active
                      ? "border-accent/35 bg-petal/70 text-ink"
                      : "border-line bg-card/50 text-muted hover:bg-petal/40 hover:text-ink",
                  )}
                  whileTap={{ scale: 0.97 }}
                >
                  {theme.icon}
                  {theme.label}
                  {active ? (
                    <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2.4} />
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Notifications"
          description="Quiet by design — nothing ever interrupts her."
          delay={0.1}
        >
          <div className="divide-y divide-line-warm">
            <Toggle
              checked={notifications}
              onChange={setNotifications}
              label="In-app notices"
              description="Confirmations when a piece is saved or filed."
            />
            <Toggle
              checked={priceDropAlerts}
              onChange={setPriceDropAlerts}
              label="Price-drop alerts"
              description="Flag a piece on the board when its price falls."
            />
          </div>
        </Panel>

        <Panel
          title="Connected stores"
          description="Any https link works. These houses are recognised by name."
          delay={0.15}
        >
          <ul className="divide-y divide-line-warm">
            {STORE_KEYS.filter((key) => key !== "other").map((key) => {
              const store = STORES[key];
              const count = storeCounts.get(key) ?? 0;
              return (
                <li key={key} className="flex items-center gap-3 py-3.5">
                  <StoreDot store={key} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9rem] text-ink">
                      {store.label}
                    </span>
                    <span className="text-[0.76rem] text-muted">
                      {count ? pluralise(count, "piece") : "Nothing yet"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[0.66rem] font-medium tracking-[0.06em] uppercase",
                      store.extension === "live"
                        ? "border-good/30 bg-good/12 text-good"
                        : "border-line bg-card/50 text-muted",
                    )}
                  >
                    {store.extension === "live" ? "Extension" : "Links only"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Sync" description="Where this wardrobe is kept." delay={0.2}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-[0.86rem]">
            <div>
              <dt className="mb-1 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
                Storage
              </dt>
              <dd className="text-ink">
                {mode === "supabase"
                  ? "Supabase"
                  : mode === "atelier"
                    ? "This browser"
                    : "Opening…"}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
                Last synced
              </dt>
              <dd className="text-ink">
                {lastSyncedAt ? formatRelative(lastSyncedAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
                Pieces
              </dt>
              <dd className="tabular-nums text-ink">{products.length}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
                Collections
              </dt>
              <dd className="tabular-nums text-ink">{collections.length}</dd>
            </div>
          </dl>

          <Button
            variant="glass"
            size="sm"
            className="mt-6"
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} />
            Sync now
          </Button>

          {mode === "atelier" ? (
            <p className="mt-5 rounded-sm border border-gold/35 bg-gold/8 px-4 py-3 text-[0.78rem] leading-relaxed text-ink">
              Running in atelier mode. Add{" "}
              <code className="rounded-xs bg-card/70 px-1.5 py-0.5 text-[0.72rem]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded-xs bg-card/70 px-1.5 py-0.5 text-[0.72rem]">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              to keep everything in the cloud and let the extension save into it.
            </p>
          ) : null}
        </Panel>

        <ExtensionPanel />
      </div>
    </main>
  );
}

function Panel({
  title,
  description,
  children,
  delay = 0,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      className="rounded-lg border border-line bg-card/60 px-6 py-6 backdrop-blur-2xl shadow-veil sm:px-8 sm:py-7"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="font-display text-[1.3rem] tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 mb-6 text-[0.83rem] leading-relaxed text-muted">
          {description}
        </p>
      ) : (
        <div className="mb-6" />
      )}
      {children}
    </motion.section>
  );
}

/**
 * The page cannot see the extension directly, so it reports on the endpoint the
 * extension needs and shows how to install it.
 */
function ExtensionPanel() {
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/extension/products")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { supabase?: boolean } | null) => {
        if (cancelled) return;
        setReachable(Boolean(payload));
        setSupabaseReady(Boolean(payload?.supabase));
      })
      .catch(() => {
        if (!cancelled) setReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel
      title="Chrome extension"
      description="Saves whole carts from Myntra and Savana in one press."
      delay={0.25}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-petal/60 text-accent">
          <Puzzle className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.88rem] text-ink">
            {reachable === null
              ? "Checking…"
              : reachable && supabaseReady
                ? "Ready to receive"
                : reachable
                  ? "Endpoint live, Supabase not configured"
                  : "Endpoint unreachable"}
          </p>
          <p className="mt-1.5 text-[0.79rem] leading-relaxed text-muted">
            Load{" "}
            <code className="rounded-xs bg-card/70 px-1.5 py-0.5 text-[0.72rem]">
              extension/
            </code>{" "}
            at{" "}
            <code className="rounded-xs bg-card/70 px-1.5 py-0.5 text-[0.72rem]">
              chrome://extensions
            </code>{" "}
            with developer mode on, then open a cart on Myntra or Savana and press{" "}
            <span className="text-ink">Save to Mon Amour</span>.
          </p>
        </div>
        <span
          aria-hidden
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            reachable === null
              ? "bg-muted/40"
              : reachable && supabaseReady
                ? "bg-good"
                : "bg-gold",
          )}
        />
      </div>
    </Panel>
  );
}
