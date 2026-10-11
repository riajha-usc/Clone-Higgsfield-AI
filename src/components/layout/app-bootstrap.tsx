"use client";

import { useEffect } from "react";
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
      .catch((error) => {
        console.error("bootstrap failed", error);
        setBootError("Local storage is unavailable in this browser, so nothing can be saved.");
      });

    fetch("/api/capabilities")
      .then((response) => (response.ok ? (response.json() as Promise<Capabilities>) : null))
      .then((capabilities) => capabilities && setCapabilities(capabilities))
      .catch(() => {});
  }, []);

  return null;
}
