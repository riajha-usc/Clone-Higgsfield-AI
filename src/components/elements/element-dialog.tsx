"use client";

import { ImagePlus, MapPin, User } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLive } from "@/lib/hooks/use-live";
import { imageFileToDataUrl } from "@/lib/image-file";
import { createElement, ElementNameError, listGenerations } from "@/lib/repo";
import type { ElementType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ElementDraft {
  type: ElementType;
  /** From the drawer: the generation whose image becomes the element. */
  imageGenerationId?: string;
  imageUrl?: string;
  description?: string;
}

const TYPE_LABELS: Record<ElementType, string> = { character: "Character", location: "Location" };

/**
 * Names and describes a new element. From the drawer the image is fixed; from the
 * Elements page you upload one or pick one of your generated images.
 */
export function ElementDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ElementDraft;
}) {
  const ids = { name: useId(), description: useId(), error: useId() };
  const [type, setType] = useState<ElementType>(draft.type);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(draft.description ?? "");
  const [image, setImage] = useState<{ generationId?: string; dataUrl?: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fixedImage = Boolean(draft.imageGenerationId);

  // Start each opening from the draft.
  useEffect(() => {
    if (!open) return;
    setType(draft.type);
    setName("");
    setDescription(draft.description ?? "");
    setImage(draft.imageGenerationId && draft.imageUrl ? { generationId: draft.imageGenerationId, url: draft.imageUrl } : null);
    setError(null);
    // Only a fresh opening resets the form; callers pass a new draft object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generations = useLive(() => listGenerations(), []);
  const pickable = useMemo(
    () => (generations ?? []).filter((g) => g.type === "image" && g.status === "succeeded" && g.outputUrl).slice(0, 24),
    [generations],
  );

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setImage({ dataUrl, url: dataUrl });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't read that image.");
    }
  }

  async function save() {
    if (!image) {
      setError("Add an image first.");
      return;
    }
    setSaving(true);
    try {
      const element = await createElement({
        type,
        name,
        description,
        imageGenerationId: image.generationId ?? null,
        imageDataUrl: image.dataUrl ?? null,
      });
      toast.success(`Saved @${element.name}. Type @${element.name} in a prompt to use it.`);
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof ElementNameError) setError(cause.message);
      else toast.error("Couldn't save the element. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle>{fixedImage ? `Save as ${TYPE_LABELS[type].toLowerCase()}` : "Create element"}</DialogTitle>
        <DialogDescription>
          Mention it as @name in any prompt. The model receives its description in place of the name.
        </DialogDescription>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div role="radiogroup" aria-label="Element type" className="flex gap-2">
            {(["character", "location"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={type === option}
                onClick={() => setType(option)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                  type === option ? "border-text-muted bg-bg text-text" : "border-line text-text-muted hover:text-text",
                )}
              >
                {option === "character" ? <User className="size-4" /> : <MapPin className="size-4" />}
                {TYPE_LABELS[option]}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-line bg-bg">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt="Element image" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-text-muted">
                  <ImagePlus className="size-5" aria-hidden />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label htmlFor={ids.name} className="mb-1 block text-xs text-text-muted">
                  Name
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">@</span>
                  <Input
                    id={ids.name}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value.replace(/\s/g, "_"));
                      setError(null);
                    }}
                    placeholder={type === "character" ? "mira" : "neon_alley"}
                    maxLength={40}
                    required
                    autoFocus
                    aria-describedby={error ? ids.error : undefined}
                    className="pl-6"
                  />
                </div>
              </div>
              {!fixedImage && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-xs text-text hover:bg-bg focus-within:outline-2 focus-within:outline-ring">
                  <ImagePlus className="size-3.5" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {!fixedImage && pickable.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs text-text-muted">Or pick one of your images</legend>
              <div className="grid grid-cols-6 gap-1.5">
                {pickable.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    title={g.prompt}
                    aria-label={`Use image: ${g.prompt}`}
                    aria-pressed={image?.generationId === g.id}
                    onClick={() => {
                      setImage({ generationId: g.id, url: g.outputUrl! });
                      if (!description) setDescription(g.prompt);
                      setError(null);
                    }}
                    className={cn(
                      "aspect-square overflow-hidden rounded-md border",
                      image?.generationId === g.id ? "border-text ring-1 ring-text" : "border-line",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.outputUrl!} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor={ids.description} className="mb-1 block text-xs text-text-muted">
              Description (sent to the model in place of @name)
            </label>
            <Textarea
              id={ids.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="A woman in her 30s with short silver hair and a dark green raincoat"
              className="text-sm"
            />
          </div>

          {error && (
            <p id={ids.error} role="alert" className="text-sm text-warning">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save element"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
