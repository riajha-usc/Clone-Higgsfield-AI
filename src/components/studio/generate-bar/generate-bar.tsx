"use client";

import { Clapperboard, Image as ImageIcon, Sparkles, Video, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ASPECTS, DURATIONS, listModels, QUALITIES, type Model } from "@/lib/catalog";
import { formatBalance, formatCost } from "@/lib/format";
import { generate, InsufficientCreditsError } from "@/lib/generate";
import { useLive } from "@/lib/hooks/use-live";
import { getBalance } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Generation, GenerationType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipButton, ChipSlot, OptionChip } from "./chip";
import { ModelChip } from "./model-chip";
import { StartFrameChip } from "./start-frame-chip";

const VIDEO_ONLY = "Video only";

interface ModeSettings {
  modelId: string;
  aspect: string;
  quality: string;
}

const INITIAL_SETTINGS: Record<GenerationType, ModeSettings> = {
  image: { modelId: "soul-2", aspect: "3:4", quality: "2k" },
  video: { modelId: "motion-preview", aspect: "16:9", quality: "480p" },
};

type Verdict =
  | { canSubmit: true; message: string }
  | { canSubmit: false; tone: "muted" | "warning"; message: React.ReactNode };

function evaluate({
  model,
  prompt,
  balance,
  mode,
  hasStartFrame,
}: {
  model: Model | undefined;
  prompt: string;
  balance: number | undefined;
  mode: GenerationType;
  hasStartFrame: boolean;
}): Verdict {
  if (!model) return { canSubmit: false, tone: "muted", message: "Choose a model" };
  if (!model.enabled) {
    return { canSubmit: false, tone: "warning", message: `${model.displayName} needs an API key on the server.` };
  }
  if (balance === undefined) return { canSubmit: false, tone: "muted", message: "Checking your balance…" };

  const cost = model.costPerGeneration;
  if (cost > balance) {
    return {
      canSubmit: false,
      tone: "warning",
      message: (
        <>
          You need {formatCost(cost)} credits and have {formatBalance(balance)}.{" "}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-text">
            Upgrade
          </Link>{" "}
          or pick a cheaper model.
        </>
      ),
    };
  }
  if (mode === "video" && model.needsStartFrame && !hasStartFrame) {
    return { canSubmit: false, tone: "warning", message: "Add a start frame to continue" };
  }

  const message = `This will cost ${formatCost(cost)}. You will have ${formatBalance(balance - cost)} left.`;
  // An empty prompt quietly disables the button; the cost line still informs.
  if (prompt.trim() === "") return { canSubmit: false, tone: "muted", message };
  return { canSubmit: true, message };
}

export function GenerateBar({ projectId, generations }: { projectId: string; generations: Generation[] }) {
  const capabilities = useAppStore((s) => s.capabilities);
  const balance = useLive(() => getBalance(), []);

  const [mode, setMode] = useState<GenerationType>("image");
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(5);
  const [startFrameId, setStartFrameId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = settings[mode];
  const isVideo = mode === "video";
  const models = useMemo(() => listModels(capabilities).filter((m) => m.type === mode), [capabilities, mode]);
  const model = models.find((m) => m.id === current.modelId);

  const images = useMemo(
    () => generations.filter((g) => g.type === "image" && g.status === "succeeded" && g.outputUrl),
    [generations],
  );
  // Derived, so a deleted start frame simply drops out.
  const startFrame = images.find((image) => image.id === startFrameId) ?? null;

  const verdict = evaluate({ model, prompt, balance, mode, hasStartFrame: Boolean(startFrame) });

  function update(patch: Partial<ModeSettings>) {
    setSettings((all) => ({ ...all, [mode]: { ...all[mode], ...patch } }));
  }

  async function submit() {
    if (!verdict.canSubmit || submitting || !model) return;
    setSubmitting(true);
    const cost = model.costPerGeneration;
    try {
      const result = await generate({
        projectId,
        type: mode,
        modelId: model.id,
        prompt: prompt.trim(),
        params: {
          aspect: current.aspect,
          quality: current.quality,
          ...(isVideo && {
            duration,
            ...(startFrame && { startFrameGenerationId: startFrame.id }),
          }),
        },
        parentGenerationId: isVideo ? (startFrame?.id ?? null) : null,
        onQueued: () => {
          setSubmitting(false);
          toast(`Generating. ${formatCost(cost)} ${cost === 1 ? "credit" : "credits"} reserved.`);
        },
      });
      if (result.status === "failed") {
        toast.error(`Generation failed: ${result.error}. ${formatCost(cost)} credits refunded.`);
      }
    } catch (error) {
      toast.error(
        error instanceof InsufficientCreditsError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Generation failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-stretch gap-3 rounded-2xl border border-line bg-panel p-3 lg:flex-nowrap"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      {/* Mode toggle */}
      <div role="radiogroup" aria-label="Mode" className="flex w-full shrink-0 flex-row gap-1 rounded-xl bg-bg p-1 sm:w-auto sm:flex-col">
        <ModeButton active={!isVideo} onClick={() => setMode("image")} icon={<ImageIcon className="size-4" />}>
          Image
        </ModeButton>
        <ModeButton active={isVideo} onClick={() => setMode("video")} icon={<Video className="size-4" />}>
          Video
        </ModeButton>
      </div>

      {/* Prompt and chips */}
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to make"
          aria-label="Prompt"
          maxLength={2000}
          rows={2}
          className="min-h-16 resize-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {/* Fixed order in both modes: video-only chips disable rather than disappear. */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="chips">
          <ModelChip models={models} value={current.modelId} onChange={(modelId) => update({ modelId })} />
          <OptionChip label="Aspect" value={current.aspect} options={ASPECTS} onChange={(aspect) => update({ aspect })} />
          <OptionChip
            label="Quality"
            value={current.quality}
            options={QUALITIES[mode]}
            onChange={(quality) => update({ quality })}
          />
          <OptionChip
            label="Duration"
            value={duration}
            options={DURATIONS}
            onChange={setDuration}
            format={(d) => `${d}s`}
            disabledReason={isVideo ? undefined : VIDEO_ONLY}
          />
          <StartFrameChip
            images={images}
            value={startFrame}
            onChange={setStartFrameId}
            disabledReason={isVideo ? undefined : VIDEO_ONLY}
          />
          <ChipSlot reason={isVideo ? "Camera presets are coming soon" : VIDEO_ONLY}>
            <ChipButton label="Presets" disabled>
              <Clapperboard className="size-3.5 text-text-muted" />
            </ChipButton>
          </ChipSlot>
          <ChipSlot reason="Prompt enhancement is coming soon. Your prompt is sent exactly as written.">
            <Toggle
              size="sm"
              disabled
              pressed={false}
              aria-label="Enhance prompt"
              className="h-8 rounded-pill border border-line px-3 text-xs"
            >
              <Wand2 className="size-3.5" />
              Enhance
              <span className="text-text-muted">Off</span>
            </Toggle>
          </ChipSlot>
        </div>
      </div>

      {/* Generate */}
      <div className="flex w-full shrink-0 flex-col justify-end gap-2 lg:w-60">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!verdict.canSubmit || submitting}
          aria-describedby="generate-status"
          className="flex h-11 items-center justify-center lg:h-14 gap-2 rounded-xl bg-lime text-sm font-semibold text-lime-foreground transition-[filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
        >
          Generate
          <span className="inline-flex items-center gap-1 rounded-pill bg-black/10 px-2 py-0.5 tabular-nums">
            <Sparkles className="size-3.5" />
            {model ? formatCost(model.costPerGeneration) : "–"}
          </span>
        </button>
        <p
          id="generate-status"
          aria-live="polite"
          className={cn(
            "min-h-8 text-xs leading-4",
            !verdict.canSubmit && verdict.tone === "warning" ? "text-warning" : "text-text-muted",
          )}
        >
          {verdict.message}
        </p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-row items-center sm:w-16 sm:flex-col justify-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        active ? "bg-panel text-text" : "text-text-muted hover:text-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
