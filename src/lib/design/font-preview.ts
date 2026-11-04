/**
 * Load the shortlist faces, once, so a font picker can show each name in its own face.
 *
 * `&text=` is what makes this cheap: Google Fonts returns a subset containing only the glyphs
 * asked for, so twenty-six families cost a few KB instead of a few hundred — we are rendering
 * twenty-six short names, not running the site in them.
 *
 * Idempotent and best-effort. A picker whose previews did not load still works: every option keeps
 * its name in the UI font, which is exactly where this control started.
 */
import { ALL_SHORTLIST_FONTS } from '$lib/design/typography';

const LINK_ID = 'font-shortlist-previews';

/** Every distinct character the picker has to draw. */
export function previewGlyphs(fonts: readonly string[]): string {
  return [...new Set(fonts.join('').split(''))].sort().join('');
}

type PreviewAsk = { text?: string; weights?: readonly number[] };

const PREVIEW_WEIGHTS = [400, 600];

export function fontPreviewHref(fonts: readonly string[] = ALL_SHORTLIST_FONTS, { text = previewGlyphs(fonts), weights = PREVIEW_WEIGHTS }: PreviewAsk = {}): string {
  const families = fonts
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${weights.join(';')}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(text)}&display=swap`;
}

export function ensureFontPreviews(fonts: readonly string[] = ALL_SHORTLIST_FONTS): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = fontPreviewHref(fonts);
  document.head.appendChild(link);
}
