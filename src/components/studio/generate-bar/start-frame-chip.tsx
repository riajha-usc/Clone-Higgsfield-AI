"use client";

import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Generation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GENERATION_DRAG_TYPE } from "../drag";
import { chipClass, ChipSlot } from "./chip";

/** Accepts a tile dragged from the grid, or a click that opens a picker of this project's images. */
export function StartFrameChip({
  images,
  value,
  onChange,
  disabledReason,
}: {
  /** Finished images in this project, newest first. */
  images: Generation[];
  value: Generation | null;
  onChange: (generationId: string | null) => void;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const disabled = Boolean(disabledReason);

  function acceptsDrag(e: React.DragEvent) {
    return !disabled && e.dataTransfer.types.includes(GENERATION_DRAG_TYPE);
  }

  return (
    <ChipSlot reason={disabledReason}>
      <span
        className="relative inline-flex"
        onDragOver={(e) => {
          if (!acceptsDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (!acceptsDrag(e)) return;
          e.preventDefault();
          const id = e.dataTransfer.getData(GENERATION_DRAG_TYPE);
          if (images.some((image) => image.id === id)) onChange(id);
        }}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild disabled={disabled}>
            <button
              type="button"
              disabled={disabled}
              aria-label={value ? "Change start frame" : "Choose start frame"}
              className={cn(chipClass, value && "pl-1", value && "pr-8", dragOver && "border-lime bg-lime/10")}
            >
              {value?.outputUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.outputUrl} alt="" className="size-6 rounded-pill object-cover" />
              ) : (
                <ImagePlus className="size-3.5 text-text-muted" />
              )}
              <span className={value ? "font-medium" : "text-text-muted"}>Start frame</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <p className="mb-2 text-sm font-medium">Start frame</p>
            {images.length === 0 ? (
              <p className="text-sm text-text-muted">
                No finished images in this project yet. Generate an image first, then use it here.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-text-muted">Pick an image, or drag one from the grid onto the chip.</p>
                <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      title={image.prompt}
                      onClick={() => {
                        onChange(image.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "aspect-[3/4] overflow-hidden rounded-md border border-line focus-visible:outline-2 focus-visible:outline-text",
                        value?.id === image.id && "border-lime ring-1 ring-lime",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.outputUrl!} alt={image.prompt} loading="lazy" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Remove start frame"
            onClick={() => onChange(null)}
            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-pill text-text-muted hover:bg-line hover:text-text"
          >
            <X className="size-3" />
          </button>
        )}
      </span>
    </ChipSlot>
  );
}
