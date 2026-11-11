import { FramePreset, PRESET_LABEL, PRESET_SIZE } from '$lib/motion/frame-presets';

export enum PromptKind {
  Motion = 'motion',
  Website = 'website'
}

export type PromptKindRow = { label: string; placeholder: string; hint: string; format: FramePreset; fromUrl: (url: string) => string };

export const PROMPT_KINDS: Record<PromptKind, PromptKindRow> = {
  [PromptKind.Motion]: { label: 'motion video', placeholder: 'Describe a launch video, or paste your website…', hint: 'Make it a motion video.', format: FramePreset.Presentation, fromUrl: (url) => `Make a launch film of ${url}` },
  [PromptKind.Website]: { label: 'website design', placeholder: 'Describe a landing page, or paste a site to redesign…', hint: 'Make it a website design.', format: FramePreset.Desktop, fromUrl: (url) => `Redesign ${url}` }
};

export const DEFAULT_KIND = PromptKind.Motion;

export const PROMPT_KIND_ORDER = Object.values(PromptKind);

export function kindOf(raw: unknown): PromptKind | null {
  const asked = raw === null || raw === undefined || raw === '' ? DEFAULT_KIND : raw;
  return PROMPT_KIND_ORDER.find((kind) => kind === asked) ?? null;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"')]+/i;
const BARE_URL = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

export function urlIn(text: string): string | null {
  const trimmed = text.trim();
  if (BARE_URL.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed.match(URL_IN_TEXT)?.[0].replace(/[.,;:!?]+$/, '') ?? null;
}

function isOnlyUrl(text: string, url: string): boolean {
  const trimmed = text.trim();
  return trimmed === url || `https://${trimmed}` === url;
}

export type Landed = { what: string; frameIds: string[] } | { what: string; refusal: string };

const LANDED_LINE = (landed: Landed) =>
  'frameIds' in landed
    ? `${landed.what} is already imported on this canvas as frame${landed.frameIds.length > 1 ? 's' : ''} ${landed.frameIds.join(', ')}: work from ${landed.frameIds.length > 1 ? 'those frames' : 'that frame'}, do not recreate it.`
    : `Importing ${landed.what} failed (${landed.refusal}). Tell me what to connect or fix, then carry on with the brief.`;

export function kindBrief(kind: PromptKind, text: string, landed: Landed | null = null): string {
  const row = PROMPT_KINDS[kind];
  const url = urlIn(text);
  const words = url && isOnlyUrl(text, url) ? row.fromUrl(url) : text.trim();
  const size = PRESET_SIZE[row.format];
  const lines = [words, `${row.hint} Start from a ${PRESET_LABEL[row.format]} frame (${size.width}×${size.height}).`];
  if (landed) {
    lines.push(LANDED_LINE(landed));
  }
  return lines.join('\n\n');
}
