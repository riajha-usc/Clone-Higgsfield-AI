"use client";

import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { enhancePrompt } from "@/lib/generate";
import type { GenerationType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Source = "gemini" | "template" | "saved";

interface Draft {
  text: string;
  source: Source;
  /** The mode and prompt it was written for. */
  key: string;
  /** The user typed into it, so it is never overwritten automatically. */
  edited: boolean;
}

const AUTO_DELAY_MS = 900;

const keyOf = (mode: GenerationType, prompt: string) => `${mode}\n${prompt.trim()}`;

/**
 * Keeps an enhanced version of the prompt while Enhance is on. It rewrites shortly
 * after typing stops, unless the user has edited the paragraph by hand.
 */
export function useEnhancement(prompt: string, mode: GenerationType, on: boolean) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const key = keyOf(mode, prompt);

  const run = useCallback(async (forMode: GenerationType, forPrompt: string): Promise<string | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    setError(null);
    try {
      const result = await enhancePrompt(forPrompt.trim(), forMode, current.signal);
      setDraft({ text: result.enhancedPrompt, source: result.source, key: keyOf(forMode, forPrompt), edited: false });
      return result.enhancedPrompt;
    } catch (cause) {
      if (current.signal.aborted) return null;
      const message = cause instanceof Error ? cause.message : "Couldn't write the enhanced prompt";
      setError(`${message}. Press Rewrite to try again, or turn Enhance off.`);
      // One toast however many rewrites fail while typing.
      toast.error(`${message}. Press Rewrite to try again, or turn Enhance off.`, { id: "enhance-error" });
      throw cause;
    } finally {
      if (controller.current === current) setPending(false);
    }
  }, []);

  useEffect(() => {
    if (!on || !prompt.trim()) return;
    if (draft && (draft.key === key || draft.edited)) return;
    const timer = setTimeout(() => void run(mode, prompt).catch(() => {}), AUTO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [on, key, draft, run, mode, prompt]);

  // Stop an in-flight rewrite when the toggle goes off.
  useEffect(() => {
    if (!on) controller.current?.abort();
  }, [on]);

  return {
    draft,
    pending,
    error,
    /** Edited by hand for an older prompt: still sent, but flagged. */
    stale: Boolean(draft?.edited && draft.key !== key),
    edit: (text: string) => setDraft((d) => (d ? { ...d, text, edited: true } : { text, source: "template", key, edited: true })),
    rewrite: () => run(mode, prompt).catch(() => null),
    /** Text written elsewhere (Recreate of an enhanced record), kept as if edited. */
    load: (text: string, forMode: GenerationType, forPrompt: string) =>
      setDraft({ text, source: "saved", key: keyOf(forMode, forPrompt), edited: true }),
    /** What to send on Generate: the current paragraph, written now if it is missing or out of date. */
    resolve: async (): Promise<string | null> => {
      if (!on || !prompt.trim()) return null;
      if (draft && (draft.edited || draft.key === key)) return draft.text;
      return run(mode, prompt);
    },
  };
}

const SOURCE_LABELS: Record<Source, string> = {
  gemini: "Written by Gemini",
  template: "Written by the built-in template",
  saved: "From the original generation",
};

export function EnhancedPromptBlock({
  enhancement,
}: {
  enhancement: ReturnType<typeof useEnhancement>;
}) {
  const [open, setOpen] = useState(true);
  const { draft, pending, error, stale } = enhancement;

  return (
    <div className="rounded-lg border border-line bg-bg" data-testid="enhanced-block">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="enhanced-prompt"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-text-muted hover:text-text"
        >
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="font-medium text-text">Enhanced prompt</span>
          <span className="truncate">
            {pending
              ? "Writing…"
              : draft
                ? `${draft.edited && draft.source !== "saved" ? "Edited" : SOURCE_LABELS[draft.source]}. This is what the model receives.`
                : "Written when you stop typing."}
          </span>
        </button>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-text-muted" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => void enhancement.rewrite()}
            className="inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-xs text-text-muted hover:bg-panel hover:text-text"
          >
            <RefreshCw className="size-3" />
            Rewrite
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-line px-1 pb-1">
          <Textarea
            id="enhanced-prompt"
            aria-label="Enhanced prompt"
            value={draft?.text ?? ""}
            onChange={(e) => enhancement.edit(e.target.value)}
            placeholder={pending ? "Writing…" : "The enhanced paragraph appears here. You can edit it."}
            maxLength={2000}
            rows={3}
            className="max-h-40 min-h-20 resize-none border-0 bg-transparent px-2 text-xs leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {(stale || error) && (
            <p className={cn("px-2 pb-1 text-[11px]", error ? "text-warning" : "text-text-muted")}>
              {error ?? "Your prompt changed after you edited this. Press Rewrite to start over from the new prompt."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
