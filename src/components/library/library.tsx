"use client";

import { Heart, Search, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { GenerationDrawer, DETAIL_PARAM } from "@/components/studio/detail/generation-drawer";
import { OptionChip } from "@/components/studio/generate-bar/chip";
import { GenerationTile } from "@/components/studio/generation-tile";
import { MODELS, getModel } from "@/lib/catalog";
import { useLive } from "@/lib/hooks/use-live";
import { listGenerations, listProjects } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Generation } from "@/lib/types";
import { cn } from "@/lib/utils";

const emptyActionClass =
  "rounded-pill border border-line px-4 py-1.5 text-sm text-text transition-colors hover:bg-panel";

const TYPES = ["all", "image", "video"] as const;
const STATUSES = ["all", "succeeded", "pending", "failed"] as const;
const MODEL_OPTIONS = ["all", ...MODELS.map((m) => m.id)] as const;

type TypeFilter = (typeof TYPES)[number];
type StatusFilter = (typeof STATUSES)[number];

const TYPE_LABELS: Record<TypeFilter, string> = { all: "All", image: "Images", video: "Videos" };
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  succeeded: "Done",
  pending: "In progress",
  failed: "Failed",
};

interface Filters {
  type: TypeFilter;
  modelId: string;
  status: StatusFilter;
  favourites: boolean;
  query: string;
}

const NO_FILTERS: Filters = { type: "all", modelId: "all", status: "all", favourites: false, query: "" };

function matches(g: Generation, f: Filters): boolean {
  if (f.type !== "all" && g.type !== f.type) return false;
  if (f.modelId !== "all" && g.modelId !== f.modelId) return false;
  if (f.status === "pending" && g.status !== "queued" && g.status !== "running") return false;
  if ((f.status === "succeeded" || f.status === "failed") && g.status !== f.status) return false;
  if (f.favourites && !g.favourite) return false;
  const q = f.query.trim().toLowerCase();
  if (q && !g.prompt.toLowerCase().includes(q) && !g.enhancedPrompt?.toLowerCase().includes(q)) return false;
  return true;
}

/** Every generation across projects, newest first, with filters. */
export function Library() {
  const ready = useAppStore((s) => s.ready);
  const generations = useLive(() => listGenerations(), []);
  const projects = useLive(() => listProjects(), []);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const projectNames = useMemo(() => new Map(projects?.map((p) => [p.id, p.name])), [projects]);
  const visible = useMemo(() => generations?.filter((g) => matches(g, filters)) ?? [], [generations, filters]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        {generations && (
          <span className="text-sm text-text-muted" data-testid="library-count">
            {filtered ? `${visible.length} of ${generations.length}` : generations.length}{" "}
            {generations.length === 1 ? "generation" : "generations"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
        <div className="relative mr-1 w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search prompts"
            aria-label="Search prompts"
            className="h-8 rounded-pill pl-8 text-xs"
          />
        </div>
        <OptionChip
          label="Type"
          value={filters.type}
          options={TYPES}
          onChange={(type) => set("type", type)}
          format={(t) => TYPE_LABELS[t]}
        />
        <OptionChip
          label="Model"
          value={filters.modelId}
          options={MODEL_OPTIONS}
          onChange={(modelId) => set("modelId", modelId)}
          format={(id) => (id === "all" ? "All" : (getModel(id)?.displayName ?? id))}
        />
        <OptionChip
          label="Status"
          value={filters.status}
          options={STATUSES}
          onChange={(status) => set("status", status)}
          format={(s) => STATUS_LABELS[s]}
        />
        <Toggle
          size="sm"
          pressed={filters.favourites}
          onPressedChange={(on) => set("favourites", on)}
          aria-label="Favourites only"
          className="h-8 rounded-pill border border-line px-3 text-xs data-[state=on]:border-text-muted"
        >
          <Heart className={cn("size-3.5", filters.favourites && "fill-current")} />
          Favourites
        </Toggle>
        {filtered && (
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            className="inline-flex h-8 items-center gap-1 rounded-pill px-3 text-xs text-text-muted hover:text-text"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-5">
        {!ready || generations === undefined ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-60 w-[180px] rounded-card" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line p-6">
            {generations.length === 0 ? (
              <>
                <p className="text-center text-sm text-text-muted">Nothing generated yet.</p>
                <Link href="/p/demo" className={emptyActionClass}>
                  Open the Studio
                </Link>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-text-muted">Nothing matches these filters.</p>
                <button type="button" onClick={() => setFilters(NO_FILTERS)} className={emptyActionClass}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {visible.map((generation) => (
              <GenerationTile
                key={generation.id}
                generation={generation}
                href={`/library?${DETAIL_PARAM}=${encodeURIComponent(generation.id)}`}
                projectName={projectNames.get(generation.projectId)}
              />
            ))}
          </div>
        )}
      </div>

      {ready && (
        <Suspense>
          <GenerationDrawer projects={projects} />
        </Suspense>
      )}
    </div>
  );
}
