"use client";

import { useEffect, useState } from "react";
import { observe } from "@/lib/repo";

/**
 * Runs a repo query and re-renders whenever the data behind it changes.
 * Returns undefined until the first result arrives.
 */
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    return observe(query, setValue, (error) => console.error("live query failed", error));
    // The caller's deps describe the query; the function identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
