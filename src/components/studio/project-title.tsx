"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { renameProject } from "@/lib/repo";
import type { Project } from "@/lib/types";
import { MAX_PROJECT_NAME } from "./project-rail";

export function ProjectTitle({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  function start() {
    setDraft(project.name);
    setEditing(true);
  }

  async function save() {
    setEditing(false);
    const name = draft.trim().slice(0, MAX_PROJECT_NAME);
    if (!name || name === project.name) return;
    try {
      await renameProject(project.id, name);
    } catch {
      toast.error("Couldn't rename the project. Try again.");
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={MAX_PROJECT_NAME}
        aria-label="Project name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 rounded-md border border-line bg-panel px-2 py-0.5 text-xl font-semibold tracking-tight outline-none focus:border-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Rename project"
      className="group flex min-w-0 items-center gap-2 rounded-md text-left"
    >
      <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
      <Pencil className="size-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}
