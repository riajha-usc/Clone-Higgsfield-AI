"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { createProject } from "@/lib/repo";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_PROJECT_NAME = 80;

export function ProjectRail({ projects, activeId }: { projects: Project[] | undefined; activeId: string }) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNaming(false);
      return;
    }
    try {
      const project = await createProject(trimmed.slice(0, MAX_PROJECT_NAME));
      setNaming(false);
      setName("");
      router.push(`/p/${project.id}`);
    } catch {
      toast.error("Could not create the project");
    }
  }

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-r border-line bg-panel md:flex">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">Projects</h2>
      </div>

      <div className="px-3 pb-2">
        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input
              autoFocus
              value={name}
              maxLength={MAX_PROJECT_NAME}
              placeholder="Project name"
              aria-label="New project name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name.trim() && setNaming(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setName("");
                  setNaming(false);
                }
              }}
            />
            <p className="mt-1 px-1 text-[11px] text-text-muted">Enter to create, Esc to cancel</p>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            <span className="flex size-6 items-center justify-center rounded-md border border-line">
              <Plus className="size-3.5" />
            </span>
            New project
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Projects">
        {projects === undefined
          ? Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="mb-1 h-12 rounded-lg" />)
          : projects.map((project) => (
              <Link
                key={project.id}
                href={`/p/${project.id}`}
                aria-current={project.id === activeId ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 transition-colors hover:bg-bg",
                  project.id === activeId && "bg-bg",
                )}
              >
                <span className="block truncate text-sm text-text">{project.name}</span>
                <span className="block text-xs text-text-muted">Created {formatDate(project.createdAt)}</span>
              </Link>
            ))}
      </nav>
    </aside>
  );
}
