"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generate, InsufficientCreditsError } from "@/lib/generate";
import { useLive } from "@/lib/hooks/use-live";
import { listGenerations, listProjects } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import { GenerationTile } from "./generation-tile";

// TEMPORARY: exercises lib/generate until the generate bar exists.
const TEST_PROMPTS = [
  "Portrait of a glassblower in a dim workshop, molten orange glow, film grain",
  "Sea stacks at blue hour, long exposure, mist rolling over the water",
  "Minimal product shot of a ceramic mug on travertine, soft window light",
];

export function ProjectView({ projectId }: { projectId: string }) {
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);
  const projects = useLive(() => listProjects(), []);
  const generations = useLive(() => listGenerations(projectId), [projectId]);
  const [submitting, setSubmitting] = useState(false);

  const project = projects?.find((p) => p.id === projectId);

  async function runTestGeneration() {
    setSubmitting(true);
    const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
    const pending = generate({ projectId, type: "image", modelId: "soul-2", prompt });
    // The tile appears via the live query as soon as the row is inserted.
    setTimeout(() => setSubmitting(false), 300);
    try {
      const result = await pending;
      if (result.status === "failed") toast.error(`Generation failed: ${result.error}`);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) toast.error(error.message);
      else toast.error(error instanceof Error ? error.message : "Generation failed");
      setSubmitting(false);
    }
  }

  if (bootError) {
    return <p className="p-6 text-sm text-destructive">{bootError}</p>;
  }

  if (!ready || projects === undefined || generations === undefined) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <Skeleton className="mb-6 h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return <p className="p-6 text-sm text-text-muted">This project does not exist in this browser.</p>;
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-text-muted">
            {generations.length} {generations.length === 1 ? "generation" : "generations"}
          </p>
        </div>
        <Button onClick={runTestGeneration} disabled={submitting} className="rounded-pill">
          Test generate (Soul 2 · 0.125)
        </Button>
      </div>

      {generations.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing generated yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {generations.map((generation) => (
            <GenerationTile key={generation.id} generation={generation} />
          ))}
        </div>
      )}
    </div>
  );
}
