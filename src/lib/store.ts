"use client";

import { create } from "zustand";
import type { Capabilities, GenerationType } from "@/lib/types";

/**
 * A request from elsewhere in the Studio (the detail drawer) to fill the generate
 * bar. Fields left out keep their current value. Never submits.
 */
export interface BarFill {
  mode: GenerationType;
  prompt?: string;
  modelId?: string;
  aspect?: string;
  quality?: string;
  duration?: number;
  /** null clears the slot. */
  startFrameId?: string | null;
}

interface AppState {
  /** True once first-run seeding has finished in this tab. */
  ready: boolean;
  bootError: string | null;
  /** Null until /api/capabilities answers; optional models stay disabled until then. */
  capabilities: Capabilities | null;
  setReady: () => void;
  setBootError: (message: string) => void;
  setCapabilities: (capabilities: Capabilities) => void;
  /** Latest fill request; the nonce makes a repeat of the same fill still apply. */
  barFill: (BarFill & { nonce: number }) | null;
  fillBar: (fill: BarFill) => void;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  bootError: null,
  capabilities: null,
  setReady: () => set({ ready: true }),
  setBootError: (message) => set({ bootError: message }),
  setCapabilities: (capabilities) => set({ capabilities }),
  barFill: null,
  fillBar: (fill) => set((s) => ({ barFill: { ...fill, nonce: (s.barFill?.nonce ?? 0) + 1 } })),
}));
