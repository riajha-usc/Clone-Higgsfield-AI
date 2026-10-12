"use client";

import { AtSign, Plus, Sparkles, Trash2, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLive } from "@/lib/hooks/use-live";
import { deleteElement, listElementsWithImages } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Element, ElementType } from "@/lib/types";
import { ElementDialog } from "./element-dialog";

const TABS: { type: ElementType; label: string; plural: string }[] = [
  { type: "character", label: "Characters", plural: "characters" },
  { type: "location", label: "Locations", plural: "locations" },
];

/** Characters and locations that can be @mentioned in any prompt. */
export function Elements() {
  const ready = useAppStore((s) => s.ready);
  const [tab, setTab] = useState<ElementType>("character");
  const [creating, setCreating] = useState(false);
  const items = useLive(() => listElementsWithImages(), []);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Elements</h1>
        <button type="button" onClick={() => setCreating(true)} className={primaryClass}>
          <Plus className="size-4" />
          Create element
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ElementType)} className="mt-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.type} value={t.type} className="px-4">
              {t.label}
              {items && <span className="ml-1 text-text-muted">{items.filter((i) => i.element.type === t.type).length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => {
          const visible = items?.filter((i) => i.element.type === t.type);
          return (
            <TabsContent key={t.type} value={t.type} className="mt-6">
              {!ready || visible === undefined ? (
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-64 w-48 rounded-card" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <EmptyState plural={t.plural} onCreate={() => setCreating(true)} />
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {visible.map(({ element, imageUrl }) => (
                    <ElementCard key={element.id} element={element} imageUrl={imageUrl} />
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <ElementDialog open={creating} onOpenChange={setCreating} draft={{ type: tab }} />
    </div>
  );
}

const primaryClass =
  "inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-foreground transition-[filter] hover:brightness-95";

function EmptyState({ plural, onCreate }: { plural: string; onCreate: () => void }) {
  const steps = [
    { icon: AtSign, title: "Create an element", body: "Save any image as a character from its details, or upload one here." },
    { icon: Sparkles, title: "Add it to a prompt", body: "Type @ in the generate bar and pick it from the list." },
    {
      icon: Layers,
      title: "Use it for consistency",
      body: "The model gets its description in place of @name, the same in every project.",
    },
  ];
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-line bg-panel">
        <AtSign className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-semibold">No {plural} yet</h2>
      <p className="mt-1 text-sm text-text-muted">Create one to use it consistently across all projects.</p>
      <ol className="mt-8 grid w-full max-w-3xl gap-px overflow-hidden rounded-card border border-line bg-line text-left sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.title} className="bg-panel p-5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <step.icon className="size-4 text-text-muted" aria-hidden />
              {step.title}
            </span>
            <p className="mt-2 text-sm text-text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onCreate}
        className="mt-8 inline-flex items-center gap-1.5 rounded-pill bg-text px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" />
        Create element
      </button>
    </div>
  );
}

function ElementCard({ element, imageUrl }: { element: Element; imageUrl: string | null }) {
  async function remove() {
    try {
      await deleteElement(element.id);
      toast(`Deleted @${element.name}. Prompts that mention it now send the name as written.`);
    } catch {
      toast.error("Couldn't delete the element. Try again.");
    }
  }
  return (
    <li className="group overflow-hidden rounded-card border border-line bg-panel">
      <div className="relative aspect-[3/4] bg-bg">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center p-4 text-center text-xs text-text-muted">
            Its image was deleted
          </span>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          aria-label={`Delete @${element.name}`}
          title="Delete"
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-pill bg-black/60 text-text opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">@{element.name}</p>
        <p className="mt-1 line-clamp-2 text-xs text-text-muted">{element.description || "No description"}</p>
      </div>
    </li>
  );
}
