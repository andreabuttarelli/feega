import { FramePreset, PRESET_LABEL, PRESET_SIZE } from '$lib/motion/frame-presets';

export enum PromptKind {
  Motion = 'motion',
  Website = 'website'
}

export type PromptKindRow = { label: string; hint: string; format: FramePreset; fromUrl: (url: string) => string };

export const PROMPT_KINDS: Record<PromptKind, PromptKindRow> = {
  [PromptKind.Motion]: { label: 'motion video', hint: 'Make it a motion video.', format: FramePreset.Presentation, fromUrl: (url) => `Make a launch film of ${url}` },
  [PromptKind.Website]: { label: 'website design', hint: 'Make it a website design.', format: FramePreset.Desktop, fromUrl: (url) => `Redesign ${url}` }
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

export type Imported = { url: string; frameId: string };

export function kindBrief(kind: PromptKind, text: string, imported: Imported | null = null): string {
  const row = PROMPT_KINDS[kind];
  const url = urlIn(text);
  const words = url && isOnlyUrl(text, url) ? row.fromUrl(url) : text.trim();
  const size = PRESET_SIZE[row.format];
  const lines = [words, `${row.hint} Start from a ${PRESET_LABEL[row.format]} frame (${size.width}×${size.height}).`];
  if (imported) {
    lines.push(`${imported.url} is already imported on this canvas as frame ${imported.frameId}: work from that frame, do not recreate it.`);
  }
  return lines.join('\n\n');
}
