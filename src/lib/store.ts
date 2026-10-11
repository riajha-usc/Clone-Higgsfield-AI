"use client";

import { create } from "zustand";
import type { Capabilities } from "@/lib/types";

interface AppState {
  /** True once first-run seeding has finished in this tab. */
  ready: boolean;
  bootError: string | null;
  /** Null until /api/capabilities answers; optional models stay disabled until then. */
  capabilities: Capabilities | null;
  setReady: () => void;
  setBootError: (message: string) => void;
  setCapabilities: (capabilities: Capabilities) => void;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  bootError: null,
  capabilities: null,
  setReady: () => set({ ready: true }),
  setBootError: (message) => set({ bootError: message }),
  setCapabilities: (capabilities) => set({ capabilities }),
}));
