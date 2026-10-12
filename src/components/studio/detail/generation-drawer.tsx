"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FastForward,
  Heart,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { aspectRatio, getModel, getPreset, outputSize, PROVIDER_LABELS } from "@/lib/catalog";
import { downloadOutput } from "@/lib/download";
import { formatCost, formatDateTime } from "@/lib/format";
import { useLive } from "@/lib/hooks/use-live";
import { deleteGeneration, getGeneration, getLineage, listChildren, updateGeneration } from "@/lib/repo";
import { useAppStore, type BarFill } from "@/lib/store";
import type { Generation, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PROMPT_INPUT_ID } from "../generate-bar/generate-bar";
import { refundLabel } from "../generation-tile";
import { PreviewPlayer } from "./preview-player";

const EXTEND_PREFIX = "Continue:";
/** How far up Made from walks parentGenerationId. */
const MAX_ANCESTORS = 5;

/** Query param that holds the open generation, so /p/[projectId]?g=[id] links straight to it. */
export const DETAIL_PARAM = "g";

export function detailHref(projectId: string, generationId: string) {
  return `/p/${projectId}?${DETAIL_PARAM}=${encodeURIComponent(generationId)}`;
}

/**
 * Right-hand detail sheet for the generation named in ?g= on the current page.
 * In the Studio, pass projectId so a generation from another project opens there;
 * the Library leaves it out and shows any generation in place.
 */
export function GenerationDrawer({ projectId, projects }: { projectId?: string; projects: Project[] | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get(DETAIL_PARAM);
  // Wrapped so "still loading" differs from "not found" (null). A result for an
  // older id also counts as loading, so switching records never flashes "Not found".
  const result = useLive(async () => ({ id, generation: id ? ((await getGeneration(id)) ?? null) : null }), [id]);
  const loaded = result?.id === id ? result : undefined;
  const generation = loaded?.generation;
  const focusPromptOnClose = useRef(false);

  // A link to a generation in another project opens that project instead.
  useEffect(() => {
    if (projectId && generation && generation.projectId !== projectId) {
      router.replace(detailHref(generation.projectId, generation.id), { scroll: false });
    }
  }, [generation, projectId, router]);

  function close() {
    router.replace(pathname, { scroll: false });
  }

  /** Fills the generate bar of the generation's project, going there first if needed. */
  function fillBarAndClose(fill: BarFill) {
    useAppStore.getState().fillBar(fill);
    const studio = generation ? `/p/${generation.projectId}` : null;
    if (studio && pathname !== studio) {
      router.push(studio);
      return;
    }
    focusPromptOnClose.current = true;
    close();
  }

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="gap-0 border-line bg-panel p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
        onCloseAutoFocus={(e) => {
          if (!focusPromptOnClose.current) return;
          focusPromptOnClose.current = false;
          e.preventDefault();
          document.getElementById(PROMPT_INPUT_ID)?.focus();
        }}
      >
        <SheetDescription className="sr-only">Details and actions for this generation</SheetDescription>
        {loaded === undefined ? (
          <>
            <SheetTitle className="sr-only">Loading</SheetTitle>
            <div className="space-y-4 p-5 pt-14">
              <Skeleton className="aspect-[4/3] w-full rounded-card" />
              <Skeleton className="h-24 w-full rounded-card" />
            </div>
          </>
        ) : !loaded.generation ? (
          <div className="p-5 pt-14">
            <SheetTitle>Not found</SheetTitle>
            <p className="mt-2 text-sm text-text-muted">This generation was deleted or the link is wrong.</p>
          </div>
        ) : (
          <Details
            key={loaded.generation.id}
            generation={loaded.generation}
            project={projects?.find((p) => p.id === loaded.generation?.projectId)}
            onOpen={(other) => router.push(`${pathname}?${DETAIL_PARAM}=${encodeURIComponent(other)}`, { scroll: false })}
            onFill={fillBarAndClose}
            onDeleted={close}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Details({
  generation,
  project,
  onOpen,
  onFill,
  onDeleted,
}: {
  generation: Generation;
  project: Project | undefined;
  onOpen: (generationId: string) => void;
  onFill: (fill: BarFill) => void;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isVideo = generation.type === "video";
  const done = generation.status === "succeeded" && Boolean(generation.outputUrl);
  const pending = generation.status === "queued" || generation.status === "running";
  const model = getModel(generation.modelId);
  const { params } = generation;

  async function toggleFavourite() {
    await updateGeneration(generation.id, { favourite: !generation.favourite });
  }

  async function remove() {
    try {
      await deleteGeneration(generation.id);
      setConfirmDelete(false);
      onDeleted();
      toast("Deleted. Credits already spent are not refunded.");
    } catch {
      toast.error("Could not delete this generation");
    }
  }

  const shared = { modelId: generation.modelId, aspect: params.aspect, quality: params.quality, duration: params.duration };
  const recreate = () =>
    onFill({
      mode: generation.type,
      prompt: generation.prompt,
      enhancedPrompt: generation.enhancedPrompt,
      ...shared,
      ...(isVideo && { startFrameId: params.startFrameGenerationId ?? null }),
    });
  const turnToVideo = () => onFill({ mode: "video", startFrameId: generation.id });
  const extend = () =>
    onFill({
      mode: "video",
      ...shared,
      prompt: `${EXTEND_PREFIX} ${generation.prompt.replace(/^Continue:\s*/i, "")}`,
      startFrameId: params.startFrameGenerationId ?? null,
      // The new video continues this one, so lineage reads image → video → extension.
      parentId: generation.id,
    });

  const size = outputSize(generation.type, params.aspect, params.quality);
  const statusLabel = {
    queued: "Queued",
    running: "Generating",
    succeeded: "Done",
    failed: refundLabel(generation.cost),
  }[generation.status];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-5 pr-12">
        {isVideo ? <Video className="size-4 text-text-muted" /> : <ImageIcon className="size-4 text-text-muted" />}
        <SheetTitle className="text-sm font-medium">{isVideo ? "Video" : "Image"}</SheetTitle>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <Preview generation={generation} />

        <section className="space-y-3">
          <PromptBlock label="Prompt" text={generation.prompt} />
          {generation.enhancedPrompt && (
            <PromptBlock label="Enhanced prompt (what the model actually received)" text={generation.enhancedPrompt} />
          )}
        </section>

        <section aria-labelledby="details-heading">
          <SectionHeading id="details-heading">Details</SectionHeading>
          <dl className="space-y-2 rounded-card bg-bg p-4 text-sm">
            <Row label="Model">{model?.displayName ?? generation.modelId}</Row>
            <Row label="Provider">{PROVIDER_LABELS[generation.provider] ?? (generation.provider || "Not assigned")}</Row>
            {params.quality && <Row label="Quality">{params.quality}</Row>}
            <Row label="Size">
              {size.width}x{size.height}
            </Row>
            {isVideo && params.duration !== undefined && <Row label="Duration">{params.duration}s</Row>}
            {isVideo && params.presetId && <Row label="Camera">{getPreset(params.presetId)?.displayName ?? params.presetId}</Row>}
            <Row label="Cost">
              {formatCost(generation.cost)} {generation.cost === 1 ? "credit" : "credits"}
            </Row>
            <Row label="Created">{formatDateTime(generation.createdAt)}</Row>
            <Row label="Status">
              <span className={cn(generation.status === "failed" && "text-destructive")}>{statusLabel}</span>
            </Row>
          </dl>
          {generation.status === "failed" && generation.error && (
            <p className="mt-2 text-xs text-text-muted">Reason: {generation.error}</p>
          )}
        </section>

        <section aria-labelledby="filed-heading">
          <SectionHeading id="filed-heading">Filed in</SectionHeading>
          <Link
            href={`/p/${generation.projectId}`}
            className="inline-flex max-w-full items-center rounded-pill border border-line bg-bg px-3 py-1.5 text-sm hover:bg-[#1c1c1f]"
          >
            <span className="truncate">{project?.name ?? "Project"}</span>
          </Link>
        </section>

        <section aria-labelledby="made-from-heading">
          <SectionHeading id="made-from-heading">Made from</SectionHeading>
          <Lineage generation={generation} onOpen={onOpen} />
        </section>

        <section aria-labelledby="used-in-heading">
          <SectionHeading id="used-in-heading">Used in</SectionHeading>
          <UsedIn generationId={generation.id} onOpen={onOpen} />
        </section>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-line p-4">
        {isVideo ? (
          <PrimaryAction onClick={recreate} icon={<RotateCcw className="size-4" />}>
            Recreate
          </PrimaryAction>
        ) : (
          <PrimaryAction onClick={turnToVideo} disabled={!done} icon={<Video className="size-4" />}>
            Turn to video
          </PrimaryAction>
        )}
        <div className="flex gap-2">
          {isVideo ? (
            <Button variant="outline" className="h-10 flex-1" onClick={extend} disabled={!done}>
              <FastForward />
              Extend
            </Button>
          ) : (
            <Button variant="outline" className="h-10 flex-1" onClick={recreate}>
              <RotateCcw />
              Recreate
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 flex-1"
            disabled={!done}
            onClick={() => downloadOutput(generation.outputUrl!, `generation-${generation.id.slice(0, 8)}`)}
          >
            <Download />
            Download
          </Button>
          <Button
            variant="outline"
            className="size-10"
            aria-label={generation.favourite ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={generation.favourite}
            title={generation.favourite ? "Remove from favourites" : "Add to favourites"}
            onClick={() => void toggleFavourite()}
          >
            <Heart className={cn(generation.favourite && "fill-current")} />
          </Button>
          <Button
            variant="outline"
            className="size-10 hover:text-destructive"
            aria-label="Delete"
            title={pending ? "Wait until it finishes to delete" : "Delete"}
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </footer>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete this {generation.type}?</DialogTitle>
          <DialogDescription>
            It is removed from the project for good. Credits already spent are not refunded.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Preview({ generation }: { generation: Generation }) {
  const { params } = generation;
  const ratio = aspectRatio(params.aspect ?? (generation.type === "video" ? "16:9" : "3:4"));
  // A motion preview plays over its start frame; fall back to the stored output.
  const startFrame = useLive(
    async () => (params.startFrameGenerationId ? ((await getGeneration(params.startFrameGenerationId)) ?? null) : null),
    [params.startFrameGenerationId],
  );

  if (generation.status === "queued" || generation.status === "running") {
    return (
      <div
        className="flex w-full items-center justify-center gap-2 rounded-card bg-[#18181b] text-sm text-text-muted"
        style={{ aspectRatio: ratio }}
      >
        <Loader2 className="size-4 animate-spin" />
        Generating
      </div>
    );
  }
  if (generation.status === "failed" || !generation.outputUrl) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-card border border-dashed border-line px-6 text-center text-sm text-text-muted"
        style={{ aspectRatio: ratio }}
      >
        {generation.error ?? "No output"}. The credits for this generation were refunded.
      </div>
    );
  }
  if (generation.type === "video") {
    const preset = params.presetId ? getPreset(params.presetId) : undefined;
    const isMotion = generation.modelId === "motion-preview" || generation.provider === "motion";
    const src = (isMotion && startFrame?.outputUrl) || generation.outputUrl;
    return (
      <PreviewPlayer
        key={src}
        src={src}
        alt={generation.prompt}
        duration={params.duration ?? 5}
        animation={preset?.cssKeyframesName}
        ratio={ratio}
      />
    );
  }
  return (
    <a href={generation.outputUrl} target="_blank" rel="noopener" className="block overflow-hidden rounded-card bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={generation.outputUrl} alt={generation.prompt} className="mx-auto max-h-[55dvh] w-auto object-contain" />
    </a>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 280;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  }

  return (
    <div className="rounded-card bg-bg p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</h3>
        <Button variant="outline" size="sm" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", long && !expanded && "line-clamp-5")}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-text-muted underline-offset-2 hover:text-text hover:underline"
        >
          {expanded ? "Show less" : "See all"}
        </button>
      )}
    </div>
  );
}

/** Ancestors up to MAX_ANCESTORS levels, root first, ending with this generation. */
function Lineage({ generation, onOpen }: { generation: Generation; onOpen: (generationId: string) => void }) {
  const chain = useLive(
    () => getLineage(generation.id, MAX_ANCESTORS),
    [generation.id, generation.parentGenerationId],
  );

  if (!generation.parentGenerationId) {
    return <p className="rounded-card bg-bg p-4 text-sm text-text-muted">Original generation</p>;
  }
  if (chain === undefined) return <Skeleton className="h-[104px] w-full rounded-card" />;

  const root = chain[0];
  const capped = chain.length > MAX_ANCESTORS;
  // The walk stopped early with a parent still named: that parent was deleted.
  const brokenAbove = Boolean(root?.parentGenerationId) && !capped;
  const hiddenAbove = Boolean(root?.parentGenerationId) && capped;

  return (
    <ol className="flex items-start gap-1 overflow-x-auto rounded-card bg-bg p-3" aria-label="Lineage, oldest first">
      {(brokenAbove || hiddenAbove) && (
        <li className="flex items-start gap-1">
          <div className="flex w-16 flex-col items-center gap-1.5 text-center">
            <span className="flex size-14 items-center justify-center rounded-lg border border-dashed border-line text-xs text-text-muted">
              {hiddenAbove ? "…" : "?"}
            </span>
            <span className="text-[11px] leading-tight text-text-muted">{hiddenAbove ? "Earlier" : "Deleted"}</span>
          </div>
          <Arrow />
        </li>
      )}
      {chain.map((node, index) => {
        const isSelf = node.id === generation.id;
        return (
          <li key={node.id} className="flex items-start gap-1">
            <LineageNode generation={node} current={isSelf} onOpen={onOpen} />
            {index < chain.length - 1 && <Arrow />}
          </li>
        );
      })}
    </ol>
  );
}

function Arrow() {
  return <ArrowRight className="mt-5 size-4 shrink-0 text-text-muted" aria-hidden />;
}

function LineageNode({
  generation,
  current,
  onOpen,
}: {
  generation: Generation;
  current: boolean;
  onOpen: (generationId: string) => void;
}) {
  const thumb = generation.thumbnailUrl ?? generation.outputUrl;
  const label = generation.type === "video" ? "Video" : "Image";
  const content = (
    <>
      <span
        className={cn(
          "relative block size-14 overflow-hidden rounded-lg border bg-panel",
          current ? "border-text" : "border-line",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
        {generation.type === "video" && (
          <Video className="absolute bottom-1 right-1 size-3.5 text-white drop-shadow" aria-hidden />
        )}
      </span>
      <span className={cn("text-[11px] leading-tight", current ? "font-medium text-text" : "text-text-muted")}>
        {current ? `This ${label.toLowerCase()}` : label}
      </span>
    </>
  );
  if (current) {
    return (
      <div className="flex w-16 flex-col items-center gap-1.5 text-center" aria-current="true">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(generation.id)}
      title={generation.prompt}
      className="flex w-16 flex-col items-center gap-1.5 rounded-lg text-center hover:[&>span:first-child]:border-text-muted focus-visible:outline-2 focus-visible:outline-text"
    >
      {content}
    </button>
  );
}

/** Generations whose parent is this one. */
function UsedIn({ generationId, onOpen }: { generationId: string; onOpen: (generationId: string) => void }) {
  const children = useLive(() => listChildren(generationId), [generationId]);

  if (children === undefined) return <Skeleton className="h-[72px] w-full rounded-card" />;
  if (children.length === 0) {
    return <p className="rounded-card bg-bg p-4 text-sm text-text-muted">Not used in anything yet</p>;
  }
  return (
    <ul className="space-y-1 rounded-card bg-bg p-2">
      {children.map((child) => {
        const thumb = child.thumbnailUrl ?? child.outputUrl;
        return (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => onOpen(child.id)}
              className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-[#1c1c1f] focus-visible:outline-2 focus-visible:outline-text"
            >
              <span className="size-10 shrink-0 overflow-hidden rounded-md border border-line bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {child.type === "video" ? <Video className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                  {child.type === "video" ? "Video" : "Image"}
                </span>
                <span className="block truncate text-xs text-text-muted">{child.prompt}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
      {children}
    </h3>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function PrimaryAction({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-lime text-sm font-semibold text-lime-foreground transition-[filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}
