"use client";

import { FastForward, Image as ImageIcon, Sparkles, Video, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ASPECTS, DURATIONS, getModel, listModels, QUALITIES, type Model } from "@/lib/catalog";
import { formatBalance, formatCost } from "@/lib/format";
import { generate, InsufficientCreditsError } from "@/lib/generate";
import { useLive } from "@/lib/hooks/use-live";
import { expandMentions, mentionAtCaret, mentionedElements } from "@/lib/mentions";
import { getBalance, listElementsWithImages } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Generation, GenerationType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chipClass, OptionChip } from "./chip";
import { EnhancedPromptBlock, useEnhancement } from "./enhanced-prompt";
import { PresetChip } from "./preset-chip";
import { ModelChip } from "./model-chip";
import { StartFrameChip } from "./start-frame-chip";

const VIDEO_ONLY = "Video only";

/** id of the prompt textarea, so the detail drawer can hand focus back to it on close. */
export const PROMPT_INPUT_ID = "generate-prompt";

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
  /** Start frame from an element's image, set by picking an @mention in Video mode. */
  const [startFrameElementId, setStartFrameElementId] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const elementItems = useLive(() => listElementsWithImages(), []);
  const elements = useMemo(() => elementItems?.map((i) => i.element) ?? [], [elementItems]);
  // What the model receives: each @name replaced by that element's description.
  const promptForModel = useMemo(() => expandMentions(prompt, elements), [prompt, elements]);
  const [submitting, setSubmitting] = useState(false);
  const [enhanceOn, setEnhanceOn] = useState(false);
  const [presetId, setPresetId] = useState("push-in");
  /** Set by Extend: the next video is recorded as made from this generation. */
  const [continuesId, setContinuesId] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  /** Caret to restore after a programmatic prompt change (picking an @mention). */
  const pendingCaret = useRef<number | null>(null);
  // Before paint and before the next keystroke, so fast typing lands after the mention.
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !promptRef.current) return;
    promptRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [prompt]);
  const enhancement = useEnhancement(promptForModel, mode, enhanceOn);

  // Fills requested by the detail drawer (Turn to video, Recreate, Extend). Never submits.
  // Applied once and cleared, so it also reaches a bar that mounts after navigation.
  const barFill = useAppStore((s) => s.barFill);
  const clearBarFill = useAppStore((s) => s.clearBarFill);
  useEffect(() => {
    if (!barFill) return;
    clearBarFill(barFill.nonce);
    const { mode: nextMode, prompt: nextPrompt, modelId, aspect, quality, duration: nextDuration, startFrameId: frame } =
      barFill;
    setMode(nextMode);
    if (nextPrompt !== undefined) setPrompt(nextPrompt);
    setContinuesId(barFill.parentId ?? null);
    if (barFill.presetId) setPresetId(barFill.presetId);
    if (barFill.enhancedPrompt === null) setEnhanceOn(false);
    if (barFill.enhancedPrompt) {
      setEnhanceOn(true);
      enhancement.load(barFill.enhancedPrompt, nextMode, nextPrompt ?? prompt);
    }
    setSettings((all) => {
      const known = modelId && getModel(modelId)?.type === nextMode;
      const patch: Partial<ModeSettings> = {
        ...(known && { modelId }),
        ...(aspect && (ASPECTS as readonly string[]).includes(aspect) && { aspect }),
        ...(quality && QUALITIES[nextMode].includes(quality) && { quality }),
      };
      return { ...all, [nextMode]: { ...all[nextMode], ...patch } };
    });
    const validDuration = DURATIONS.find((d) => d === nextDuration);
    if (validDuration) setDuration(validDuration);
    if (frame !== undefined) {
      setStartFrameId(frame);
      setStartFrameElementId(null);
    }
    promptRef.current?.focus();
    // Only a new fill should run this; the other values are read as of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barFill, clearBarFill]);

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
  const startFrameElement =
    (!startFrame && elementItems?.find((i) => i.element.id === startFrameElementId && i.imageUrl)) || null;
  const startFrameValue = startFrame
    ? { id: startFrame.id, url: startFrame.outputUrl! }
    : startFrameElement
      ? { id: startFrameElement.element.id, url: startFrameElement.imageUrl!, label: `@${startFrameElement.element.name}` }
      : null;
  const mentionOptions =
    mention && elementItems
      ? elementItems.filter((i) => i.element.name.toLowerCase().startsWith(mention.query.toLowerCase())).slice(0, 8)
      : [];
  const mentioned = mentionedElements(prompt, elements);
  const continues = isVideo ? (generations.find((g) => g.id === continuesId) ?? null) : null;

  const verdict = evaluate({ model, prompt, balance, mode, hasStartFrame: Boolean(startFrameValue) });

  function trackMention(text: string, caret: number | null) {
    const next = caret === null ? null : mentionAtCaret(text, caret);
    setMention(next);
    if (next?.query !== mention?.query) setMentionIndex(0);
  }

  /** Puts @name at the caret; in Video mode, the element's image also fills an empty Start frame. */
  function pickMention(item: { element: (typeof elements)[number]; imageUrl: string | null }) {
    if (!mention) return;
    const caret = promptRef.current?.selectionStart ?? prompt.length;
    const insert = `@${item.element.name} `;
    setPrompt(prompt.slice(0, mention.start) + insert + prompt.slice(caret));
    setMention(null);
    pendingCaret.current = mention.start + insert.length;
    promptRef.current?.focus();
    if (isVideo && !startFrameValue && item.imageUrl) {
      const own = item.element.imageGenerationId && images.some((g) => g.id === item.element.imageGenerationId);
      if (own) setStartFrameId(item.element.imageGenerationId);
      else setStartFrameElementId(item.element.id);
      toast(`@${item.element.name} is now the start frame.`);
    }
  }

  function update(patch: Partial<ModeSettings>) {
    setSettings((all) => ({ ...all, [mode]: { ...all[mode], ...patch } }));
  }

  async function submit() {
    if (!verdict.canSubmit || submitting || !model) return;
    setSubmitting(true);
    const cost = model.costPerGeneration;
    let enhancedPrompt: string | null;
    try {
      // Enhanced text is already written from the expanded prompt; otherwise send the expansion itself.
      enhancedPrompt =
        (await enhancement.resolve()) ?? (promptForModel.trim() !== prompt.trim() ? promptForModel.trim() : null);
    } catch {
      // useEnhancement already told the person what went wrong.
      setSubmitting(false);
      return;
    }
    try {
      const result = await generate({
        projectId,
        type: mode,
        modelId: model.id,
        prompt: prompt.trim(),
        enhancedPrompt,
        params: {
          aspect: current.aspect,
          quality: current.quality,
          ...(isVideo && {
            duration,
            ...(startFrame && { startFrameGenerationId: startFrame.id }),
            ...(startFrameElement && { startFrameElementId: startFrameElement.element.id }),
            ...(model.provider === "motion" && { presetId }),
          }),
        },
        parentGenerationId: isVideo
          ? (continues?.id ?? startFrame?.id ?? startFrameElement?.element.imageGenerationId ?? null)
          : null,
        onQueued: (_generation, startsInMs) => {
          setSubmitting(false);
          setContinuesId(null);
          const reserved = `${formatCost(cost)} ${cost === 1 ? "credit" : "credits"} reserved.`;
          toast(startsInMs > 0 ? `Queued, starting in ${Math.ceil(startsInMs / 1000)}s. ${reserved}` : `Generating. ${reserved}`);
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
      className="flex flex-wrap items-stretch gap-3 rounded-2xl border border-line bg-panel p-3 transition-colors has-[textarea:focus]:border-text-muted lg:flex-nowrap"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      {/* Mode toggle */}
      <div role="radiogroup" aria-label="Mode" className="flex w-full shrink-0 flex-row gap-1 self-start rounded-xl bg-bg p-1 sm:w-auto sm:flex-col">
        <ModeButton active={!isVideo} onClick={() => setMode("image")} icon={<ImageIcon className="size-4" />}>
          Image
        </ModeButton>
        <ModeButton active={isVideo} onClick={() => setMode("video")} icon={<Video className="size-4" />}>
          Video
        </ModeButton>
      </div>

      {/* Prompt and chips */}
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
        <Popover open={mention !== null} onOpenChange={(open) => !open && setMention(null)}>
          <PopoverAnchor asChild>
            <Textarea
              ref={promptRef}
              id={PROMPT_INPUT_ID}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                trackMention(e.target.value, e.target.selectionStart);
              }}
              onSelect={(e) => trackMention(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={(e) => {
                if (!mention) return;
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
                if (mentionOptions.length === 0) return;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  setMentionIndex((i) => (i + step + mentionOptions.length) % mentionOptions.length);
                } else if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
                  e.preventDefault();
                  e.stopPropagation();
                  pickMention(mentionOptions[Math.min(mentionIndex, mentionOptions.length - 1)]);
                }
              }}
              placeholder="Describe what you want to make. Type @ to add a character or location."
              aria-label="Prompt"
              aria-autocomplete="list"
              aria-controls={mention ? "mention-list" : undefined}
              aria-activedescendant={mention && mentionOptions.length ? `mention-${mentionIndex}` : undefined}
              aria-describedby={mentioned.length ? "mention-note" : undefined}
              maxLength={2000}
              rows={2}
              className="min-h-16 resize-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="start"
            className="w-72 p-1"
            aria-label="Elements"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {mentionOptions.length === 0 ? (
              <p className="p-2 text-xs text-text-muted">
                {elements.length === 0 ? (
                  <>
                    No elements yet. Save an image as a character from its details, or{" "}
                    <Link href="/elements" className="underline underline-offset-2 hover:text-text">
                      create one
                    </Link>
                    .
                  </>
                ) : (
                  `No element starts with "${mention?.query}".`
                )}
              </p>
            ) : (
              <ul id="mention-list" role="listbox" aria-label="Elements">
                {mentionOptions.map((item, index) => (
                  <li
                    key={item.element.id}
                    id={`mention-${index}`}
                    role="option"
                    aria-selected={index === mentionIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickMention(item)}
                    onMouseEnter={() => setMentionIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm",
                      index === mentionIndex && "bg-accent",
                    )}
                  >
                    <span className="size-8 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="size-full object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">@{item.element.name}</span>
                      <span className="block text-xs capitalize text-text-muted">{item.element.type}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        {mentioned.length > 0 && !enhanceOn && (
          <p id="mention-note" className="px-1 text-[11px] text-text-muted">
            {mentioned.map((e) => `@${e.name}`).join(", ")} {mentioned.length === 1 ? "is" : "are"} sent as{" "}
            {mentioned.length === 1 ? "its" : "their"} saved description.
          </p>
        )}
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
            value={startFrameValue}
            onChange={(id) => {
              setStartFrameId(id);
              setStartFrameElementId(null);
            }}
            disabledReason={isVideo ? undefined : VIDEO_ONLY}
          />
          <PresetChip
            value={presetId}
            onChange={setPresetId}
            frameUrl={startFrameValue?.url ?? null}
            disabledReason={
              !isVideo ? VIDEO_ONLY : model?.provider !== "motion" ? "Camera moves apply to motion previews" : undefined
            }
          />
          <Toggle
            size="sm"
            pressed={enhanceOn}
            onPressedChange={setEnhanceOn}
            title="Rewrite your prompt into a detailed paragraph before it is sent. You can read and edit it first."
            className="h-8 rounded-pill border border-line px-3 text-xs data-[state=on]:border-text-muted"
          >
            <Wand2 className="size-3.5" />
            Enhance
            {/* aria-pressed already says on or off; this is for sighted users. */}
            <span aria-hidden className={enhanceOn ? "font-medium text-text" : "text-text-muted"}>
              {enhanceOn ? "On" : "Off"}
            </span>
          </Toggle>
          {continues && (
            <span className={cn(chipClass, "pr-1.5")} data-testid="continues-chip">
              <FastForward className="size-3.5 text-text-muted" />
              <span className="text-text-muted">Continues</span>
              <span className="max-w-32 truncate font-medium">{continues.prompt}</span>
              <button
                type="button"
                aria-label="Stop continuing this video"
                onClick={() => setContinuesId(null)}
                className="flex size-5 items-center justify-center rounded-pill text-text-muted hover:bg-line hover:text-text"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
        </div>
        {enhanceOn && (prompt.trim() || enhancement.draft) && <EnhancedPromptBlock enhancement={enhancement} />}
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
