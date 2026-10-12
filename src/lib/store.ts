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
  /** Records the next generation as made from this one (Extend), instead of from the start frame. */
  parentId?: string | null;
  /** Camera preset for motion previews. */
  presetId?: string;
  /** Turns Enhance on with this text already written (Recreate of an enhanced record). */
  enhancedPrompt?: string | null;
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
  /**
   * Pending fill request. The generate bar applies it and clears it, so a bar that
   * mounts later (after navigating from the Library) still picks it up.
   */
  barFill: (BarFill & { nonce: number }) | null;
  fillBar: (fill: BarFill) => void;
  clearBarFill: (nonce: number) => void;
  /** Generations waiting for a rate-limit slot, with the time they will start. Not persisted. */
  queuedUntil: Record<string, number>;
  setQueuedUntil: (generationId: string, startAt: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  bootError: null,
  capabilities: null,
  setReady: () => set({ ready: true }),
  setBootError: (message) => set({ bootError: message }),
  setCapabilities: (capabilities) => set({ capabilities }),
  barFill: null,
  queuedUntil: {},
  setQueuedUntil: (generationId, startAt) =>
    set((s) => {
      const next = { ...s.queuedUntil };
      if (startAt === null) delete next[generationId];
      else next[generationId] = startAt;
      return { queuedUntil: next };
    }),
  fillBar: (fill) => set((s) => ({ barFill: { ...fill, nonce: (s.barFill?.nonce ?? 0) + 1 } })),
  clearBarFill: (nonce) => set((s) => (s.barFill?.nonce === nonce ? { barFill: null } : {})),
}));
