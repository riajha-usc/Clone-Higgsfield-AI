"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLive } from "@/lib/hooks/use-live";
import { listGenerations, listProjects } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import { AssetGrid } from "./asset-grid";
import { GenerationDrawer } from "./detail/generation-drawer";
import { GenerateBar } from "./generate-bar/generate-bar";
import { ProjectRail } from "./project-rail";
import { ProjectTitle } from "./project-title";

export function Studio({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);
  const projects = useLive(() => listProjects(), []);
  const generations = useLive(() => listGenerations(projectId), [projectId]);

  const project = projects?.find((p) => p.id === projectId);
  const unknownProject = ready && projects !== undefined && !project;

  useEffect(() => {
    if (unknownProject && projects && projects.length > 0) {
      router.replace(`/p/${projects[0].id}${window.location.search}`);
    }
  }, [unknownProject, projects, router]);

  if (bootError) {
    return <p className="p-6 text-sm text-destructive">{bootError}</p>;
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <ProjectRail projects={projects} activeId={projectId} />

      <section className="flex min-w-0 flex-1 flex-col">
        {!ready || !project || generations === undefined ? (
          <div className="flex-1 p-6">
            <Skeleton className="mb-6 h-7 w-48" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-60 w-[180px] rounded-card" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-baseline gap-3 px-6 pb-3 pt-5">
              <ProjectTitle project={project} />
              <span className="text-sm text-text-muted">
                {generations.length} {generations.length === 1 ? "asset" : "assets"}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              <AssetGrid generations={generations} />
            </div>
            <div className="shrink-0 border-t border-line bg-bg px-4 py-3 sm:px-6">
              <GenerateBar projectId={project.id} generations={generations} />
            </div>
          </>
        )}
      </section>

      {ready && (
        <Suspense>
          <GenerationDrawer projectId={projectId} projects={projects} />
        </Suspense>
      )}
    </div>
  );
}
