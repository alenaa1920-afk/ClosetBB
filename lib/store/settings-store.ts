"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  /** Price-drop and new-arrival notices inside the app. */
  notifications: boolean;
  priceDropAlerts: boolean;
  /** Confetti only ever fires for the very first saved piece. */
  hasCelebrated: boolean;
  setNotifications: (value: boolean) => void;
  setPriceDropAlerts: (value: boolean) => void;
  markCelebrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: true,
      priceDropAlerts: true,
      hasCelebrated: false,
      setNotifications: (notifications) => set({ notifications }),
      setPriceDropAlerts: (priceDropAlerts) => set({ priceDropAlerts }),
      markCelebrated: () => set({ hasCelebrated: true }),
    }),
    { name: "mon-amour.settings" },
  ),
);
