/**
 * Text helpers for briefs and drafts. No runtime imports so node:test can
 * load this file directly.
 */

/** Collapse whitespace runs (NWS products are hard-wrapped at ~70 cols). */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Clip text to at most `max` characters without cutting a word in half.
 * Prefers the last sentence end inside the window; otherwise the last word
 * boundary, then appends a single ellipsis. Text that already fits is
 * returned unchanged (whitespace-normalized).
 */
export function clipText(text: string, max: number): string {
  const clean = normalizeWhitespace(text);
  if (clean.length <= max) return clean;
  const budget = Math.max(1, max - 1); // room for the ellipsis
  const window = clean.slice(0, budget + 1);

  // Sentence boundary: ". " / "! " / "? " / "..." followed by space.
  let sentenceEnd = -1;
  const re = /[.!?](?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(window)) !== null) {
    if (m.index + 1 <= budget) sentenceEnd = m.index + 1;
  }
  if (sentenceEnd >= Math.floor(budget * 0.5)) {
    return `${clean.slice(0, sentenceEnd).trim()} …`;
  }

  const lastSpace = window.lastIndexOf(" ", budget);
  const cut = lastSpace > 0 ? lastSpace : budget;
  return `${clean.slice(0, cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}
