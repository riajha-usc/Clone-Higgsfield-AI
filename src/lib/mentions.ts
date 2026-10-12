import type { Element } from "@/lib/types";

const MENTION = /@([A-Za-z0-9_-]+)/g;

function byName(elements: Element[]) {
  return new Map(elements.map((e) => [e.name.toLowerCase(), e]));
}

/** Elements mentioned as @name in the text, in order, without repeats. */
export function mentionedElements(text: string, elements: Element[]): Element[] {
  const index = byName(elements);
  const found = new Map<string, Element>();
  for (const [, name] of text.matchAll(MENTION)) {
    const element = index.get(name.toLowerCase());
    if (element) found.set(element.id, element);
  }
  return [...found.values()];
}

/**
 * Replaces each @name that matches an element with its description (or its bare
 * name when it has none). Unknown @words are left as typed.
 */
export function expandMentions(text: string, elements: Element[]): string {
  const index = byName(elements);
  return text.replace(MENTION, (match, name: string) => {
    const element = index.get(name.toLowerCase());
    if (!element) return match;
    return element.description || element.name;
  });
}

/** The @word being typed at the caret, if any: where it starts and what follows the @. */
export function mentionAtCaret(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([A-Za-z0-9_-]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}
