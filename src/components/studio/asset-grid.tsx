import type { Generation } from "@/lib/types";
import { GenerationTile } from "./generation-tile";

/** Newest first, left to right. Rows share a height; each tile keeps its own aspect. */
export function AssetGrid({ generations }: { generations: Generation[] }) {
  if (generations.length === 0) {
    return (
      <div className="flex h-full min-h-60 items-center justify-center rounded-card border border-dashed border-line">
        <p className="max-w-xs text-center text-sm text-text-muted">
          Nothing here yet. Describe what you want to make below and press Generate.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {generations.map((generation) => (
        <GenerationTile key={generation.id} generation={generation} />
      ))}
    </div>
  );
}
