import type { Generation } from "@/lib/types";
import { PROMPT_INPUT_ID } from "./generate-bar/generate-bar";
import { GenerationTile } from "./generation-tile";

/** Newest first, left to right. Rows share a height; each tile keeps its own aspect. */
export function AssetGrid({ generations }: { generations: Generation[] }) {
  if (generations.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line p-6">
        <p className="text-center text-sm text-text-muted">Nothing here yet. Describe something below.</p>
        <button
          type="button"
          onClick={() => document.getElementById(PROMPT_INPUT_ID)?.focus()}
          className="rounded-pill border border-line px-4 py-1.5 text-sm text-text transition-colors hover:bg-panel"
        >
          Write a prompt
        </button>
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
