"use client";

import { Clapperboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPreset, PRESETS } from "@/lib/catalog";
import { ChipButton, ChipSlot } from "./chip";

const SAMPLE_FRAME = "/samples/02-desert-dawn.png";

/** Camera move for motion previews. Each option previews the move on the start frame. */
export function PresetChip({
  value,
  onChange,
  frameUrl,
  disabledReason,
}: {
  value: string;
  onChange: (presetId: string) => void;
  /** The current start frame, so previews show the real image. */
  frameUrl: string | null;
  disabledReason?: string;
}) {
  const disabled = Boolean(disabledReason);
  const current = getPreset(value);
  return (
    <ChipSlot reason={disabledReason}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <ChipButton label="Camera" value={current?.displayName ?? "None"} caret disabled={disabled}>
            <Clapperboard className="size-3.5 text-text-muted" />
          </ChipButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64" aria-label="Camera move">
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {PRESETS.map((preset) => (
              <DropdownMenuRadioItem key={preset.id} value={preset.id} className="gap-3 py-1.5">
                <span className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-bg" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frameUrl ?? SAMPLE_FRAME}
                    alt=""
                    className="size-full object-cover"
                    style={{ animation: `${preset.cssKeyframesName} 2.4s ease-in-out infinite alternate` }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm">{preset.displayName}</span>
                  <span className="block truncate text-xs text-text-muted">{preset.description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ChipSlot>
  );
}
