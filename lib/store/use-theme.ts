"use client";

import { useCallback, useEffect, useState } from "react";
import {
  resolveTheme,
  systemTheme,
  useThemeStore,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-store";

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/**
 * Single source of truth for the palette. Keeps <html> in step with the stored
 * preference and, when that preference is `system`, with the OS itself.
 */
export function useTheme() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const toggleStore = useThemeStore((state) => state.toggle);

  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyTheme(next);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      applyTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const toggle = useCallback(() => toggleStore(resolved), [resolved, toggleStore]);

  const choose = useCallback(
    (next: ThemePreference) => setPreference(next),
    [setPreference],
  );

  return { preference, resolved, mounted, toggle, setPreference: choose };
}
