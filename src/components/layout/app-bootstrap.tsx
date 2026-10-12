"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { resumePendingGenerations } from "@/lib/generate";
import { ensureSeeded } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Capabilities } from "@/lib/types";

/** Seeds IndexedDB on the first visit, resumes unfinished jobs and loads server capabilities. */
export function AppBootstrap() {
  useEffect(() => {
    const { setReady, setBootError, setCapabilities } = useAppStore.getState();

    ensureSeeded()
      .then(() => {
        setReady();
        return resumePendingGenerations();
      })
      .then((resumed) => {
        const failed = resumed.filter((g) => g.status === "failed").length;
        if (failed > 0) {
          toast.error(
            failed === 1
              ? "A generation that was running when you left didn't finish. Its credits were refunded."
              : `${failed} generations that were running when you left didn't finish. Their credits were refunded.`,
          );
        }
      })
      .catch((error) => {
        console.error("bootstrap failed", error);
        setBootError("Local storage is unavailable in this browser, so nothing can be saved.");
      });

    fetch("/api/capabilities")
      .then((response) => (response.ok ? (response.json() as Promise<Capabilities>) : null))
      .then((capabilities) => {
        if (!capabilities) throw new Error("capabilities unavailable");
        setCapabilities(capabilities);
      })
      .catch(() => {
        toast.error("Couldn't check which models the server offers, so optional ones show as unavailable.");
      });
  }, []);

  return null;
}
