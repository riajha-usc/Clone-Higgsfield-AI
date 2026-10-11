"use client";

import { Download, Heart, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { aspectRatio, getModel, getPreset } from "@/lib/catalog";
import { downloadOutput } from "@/lib/download";
import { formatCost } from "@/lib/format";
import { deleteGeneration, updateGeneration } from "@/lib/repo";
import type { Generation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { detailHref } from "./detail/generation-drawer";
import { GENERATION_DRAG_TYPE } from "./drag";

const ROW_HEIGHT = 240;
const IMAGE_RATIO = 3 / 4;

export function GenerationTile({ generation }: { generation: Generation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const model = getModel(generation.modelId);
  const preset = generation.params.presetId ? getPreset(generation.params.presetId) : undefined;
  const ratio = generation.type === "image" ? IMAGE_RATIO : aspectRatio(generation.params.aspect ?? "16:9");
  const done = generation.status === "succeeded" && generation.outputUrl;
  const pending = generation.status === "queued" || generation.status === "running";
  const draggable = Boolean(done) && generation.type === "image";

  async function toggleFavourite() {
    await updateGeneration(generation.id, { favourite: !generation.favourite });
  }

  async function remove() {
    try {
      await deleteGeneration(generation.id);
      toast("Deleted. Credits already spent are not refunded.");
    } catch {
      toast.error("Could not delete this generation");
    }
  }

  return (
    <figure
      className="group relative shrink-0 overflow-hidden rounded-card border border-line bg-panel"
      style={{ aspectRatio: ratio, width: `min(100%, ${Math.round(ROW_HEIGHT * ratio)}px)` }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(GENERATION_DRAG_TYPE, generation.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      {done ? (
        <Output generation={generation} animation={preset?.cssKeyframesName} />
      ) : (
        <div className={cn("size-full", pending && "animate-pulse bg-[#18181b]")} />
      )}

      {/* Covers the tile under the hover actions; opens the detail drawer. */}
      <Link
        href={detailHref(generation.projectId, generation.id)}
        scroll={false}
        draggable={false}
        aria-label={`Open details: ${generation.prompt}`}
        className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
      />

      {pending && (
        <StatusPill className="bg-black/70 text-text">
          <Loader2 className="size-3.5 animate-spin" />
          Generating
        </StatusPill>
      )}
      {generation.status === "failed" && (
        <StatusPill className="bg-destructive/90 text-white" title={generation.error ?? undefined}>
          Failed, credits refunded
        </StatusPill>
      )}

      {generation.type === "video" && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] text-text backdrop-blur">
          {preset ? `Motion · ${preset.displayName}` : "Video"}
        </span>
      )}

      <div
        className={cn(
          "absolute right-2 top-2 flex gap-1 transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <TileAction
          label={generation.favourite ? "Remove from favourites" : "Add to favourites"}
          onClick={toggleFavourite}
          className={generation.favourite ? "opacity-100" : undefined}
        >
          <Heart className={cn("size-4", generation.favourite && "fill-current")} />
        </TileAction>
        {done && (
          <TileAction
            label="Download"
            onClick={() => downloadOutput(generation.outputUrl!, `generation-${generation.id.slice(0, 8)}`)}
          >
            <Download className="size-4" />
          </TileAction>
        )}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More actions" className={tileActionClass}>
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void remove()}>
              <Trash2 />
              {pending ? "Delete (wait until finished)" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Favourite stays visible without hover so it reads at a glance. */}
      {generation.favourite && !menuOpen && (
        <Heart className="pointer-events-none absolute right-2 top-2 size-4 fill-text text-text drop-shadow transition-opacity group-hover:opacity-0 group-focus-within:opacity-0" />
      )}

      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-2 text-xs text-text">{generation.prompt}</p>
        <p className="mt-1 text-[11px] text-text-muted">
          {model?.displayName ?? generation.modelId} · {formatCost(generation.cost)} credits
        </p>
      </figcaption>
    </figure>
  );
}

function Output({ generation, animation }: { generation: Generation; animation?: string }) {
  const url = generation.outputUrl!;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} className="size-full object-cover" autoPlay muted loop playsInline preload="metadata" />;
  }
  return (
    // Outputs are arbitrary provider URLs, so a plain img avoids next/image domain config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={generation.prompt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="size-full object-cover"
      style={
        generation.type === "video" && animation
          ? { animation: `${animation} ${generation.params.duration ?? 5}s ease-in-out infinite alternate` }
          : undefined
      }
    />
  );
}

function StatusPill({
  className,
  title,
  children,
}: {
  className: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="status"
      title={title}
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

const tileActionClass =
  "flex size-8 items-center justify-center rounded-pill bg-black/60 text-text backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-text";

function TileAction({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn(tileActionClass, className)}>
      {children}
    </button>
  );
}
