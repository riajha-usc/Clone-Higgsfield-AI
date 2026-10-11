"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROVIDER_LABELS, type Model } from "@/lib/catalog";
import { formatCost } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChipButton } from "./chip";

export function ModelChip({
  models,
  value,
  onChange,
}: {
  /** Models for the current mode, with `enabled` already resolved. */
  models: Model[];
  value: string;
  onChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = models.find((m) => m.id === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (PROVIDER_LABELS[m.provider] ?? m.provider).toLowerCase().includes(q),
    );
  }, [models, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <ChipButton label="Model" value={selected?.displayName ?? "Choose"} caret />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            aria-label="Search models"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Models">
          {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">No models match</li>}
          {visible.map((model) => (
            <li key={model.id}>
              <button
                type="button"
                role="option"
                aria-selected={model.id === value}
                disabled={!model.enabled}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  model.enabled ? "hover:bg-[#1c1c1f]" : "cursor-not-allowed opacity-45",
                  model.id === value && "bg-[#1c1c1f]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{model.displayName}</span>
                  {!model.enabled && <span className="block text-xs text-text-muted">needs API key</span>}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px] text-text-muted">
                  {PROVIDER_LABELS[model.provider] ?? model.provider}
                </Badge>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-text-muted">
                  {formatCost(model.costPerGeneration)} cr
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
