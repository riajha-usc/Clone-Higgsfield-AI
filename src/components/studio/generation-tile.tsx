import { AlertTriangle, Heart, Loader2 } from "lucide-react";
import { getModel, getPreset } from "@/lib/catalog";
import type { Generation } from "@/lib/types";

export function GenerationTile({ generation }: { generation: Generation }) {
  const model = getModel(generation.modelId);
  const preset = generation.params.presetId ? getPreset(generation.params.presetId) : undefined;
  const done = generation.status === "succeeded" && generation.outputUrl;

  return (
    <figure className="group relative aspect-square overflow-hidden rounded-card border border-line bg-panel">
      {done ? (
        // Outputs are arbitrary provider URLs, so a plain img avoids next/image domain config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={generation.outputUrl!}
          alt={generation.prompt}
          className="size-full object-cover"
          style={
            generation.type === "video" && preset
              ? { animation: `${preset.cssKeyframesName} ${generation.params.duration ?? 5}s ease-in-out infinite alternate` }
              : undefined
          }
        />
      ) : generation.status === "failed" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangle className="size-5 text-destructive" />
          <p className="text-sm text-text">Failed, credits refunded</p>
          <p className="line-clamp-3 text-xs text-text-muted">{generation.error}</p>
        </div>
      ) : (
        <div className="flex size-full animate-pulse flex-col items-center justify-center gap-2 bg-[#1a1a1d]">
          <Loader2 className="size-5 animate-spin text-text-muted" />
          <p className="text-xs capitalize text-text-muted">{generation.status}…</p>
        </div>
      )}

      {generation.type === "video" && (
        <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] text-text backdrop-blur">
          {preset ? `Motion · ${preset.displayName}` : "Video"}
        </span>
      )}
      {generation.favourite && (
        <Heart className="absolute right-2 top-2 size-4 fill-text text-text drop-shadow" />
      )}

      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-2 text-xs text-text">{generation.prompt}</p>
        <p className="mt-1 text-[11px] text-text-muted">
          {model?.displayName ?? generation.modelId} · {generation.cost} credits
        </p>
      </figcaption>
    </figure>
  );
}
