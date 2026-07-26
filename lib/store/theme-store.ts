"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mon-amour.theme";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark, resolving `system` first. */
  toggle: (resolved: ResolvedTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "light",
      setPreference: (preference) => set({ preference }),
      toggle: (resolved) =>
        set({ preference: resolved === "dark" ? "light" : "dark" }),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

/**
 * Runs before first paint via a blocking inline script, so the correct palette
 * is already on <html> when the greeting fades in. Kept as a string because it
 * must not depend on the bundle being downloaded.
 */
export const themeInitScript = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var pref = "light";
    var raw = localStorage.getItem(key);
    if (raw) {
      var parsed = JSON.parse(raw);
      var stored = parsed && parsed.state && parsed.state.preference;
      if (stored === "light" || stored === "dark" || stored === "system") pref = stored;
    }
    var dark = pref === "dark" ||
      (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`.trim();
