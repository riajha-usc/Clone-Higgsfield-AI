"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const chipClass =
  "inline-flex h-8 items-center gap-1.5 rounded-pill border border-line bg-bg px-3 text-xs text-text transition-colors hover:bg-[#1c1c1f] focus-visible:outline-2 focus-visible:outline-ring aria-expanded:bg-[#1c1c1f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg";

interface ChipButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  label: string;
  value?: React.ReactNode;
  caret?: boolean;
}

/** Pill chip: muted label, then the current value. */
export const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(function ChipButton(
  { label, value, caret = false, className, children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className={cn(chipClass, className)} {...props}>
      <span className="text-text-muted">{label}</span>
      {value !== undefined && <span className="max-w-40 truncate font-medium">{value}</span>}
      {children}
      {caret && <ChevronDown className="size-3 text-text-muted" />}
    </button>
  );
});

/**
 * Wraps a chip so a disabled one still explains itself on hover. Disabled buttons
 * swallow pointer events, so the tooltip hangs off a wrapping span.
 */
export function ChipSlot({ reason, children }: { reason?: string; children: React.ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-pill focus-visible:outline-2 focus-visible:outline-ring">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function OptionChip<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabledReason,
  format = String,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  /** When set the chip is disabled and this explains why. */
  disabledReason?: string;
  format?: (value: T) => string;
}) {
  const disabled = Boolean(disabledReason);
  return (
    <ChipSlot reason={disabledReason}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <ChipButton label={label} value={format(value)} caret disabled={disabled} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-32">
          <DropdownMenuRadioGroup
            value={String(value)}
            onValueChange={(next) => {
              const match = options.find((option) => String(option) === next);
              if (match !== undefined) onChange(match);
            }}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={String(option)} value={String(option)}>
                {format(option)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ChipSlot>
  );
}
