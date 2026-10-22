import type { CopiedElements } from '$lib/canvas/element-clipboard.svelte';

export type CopiedTiles = {
  nodes: { type: string; data: Record<string, unknown>; dx: number; dy: number }[];
  edges: { sourceIndex: number; targetIndex: number; sourceHandle: string | null; targetHandle: string | null }[];
  freeIds: string[];
};

export type ClipboardPayload = { tiles?: CopiedTiles; elements?: CopiedElements };

export enum Pasted {
  Feega = 'feega',
  Svg = 'svg',
  Image = 'image',
  Figma = 'figma',
  Text = 'text'
}

export type PasteFile = { type: string; name: string };

export type PasteSource<F extends PasteFile = PasteFile> = { html: string; text: string; files: F[] };

export type PasteData<F extends PasteFile = PasteFile> =
  | { kind: Pasted.Feega; payload: ClipboardPayload }
  | { kind: Pasted.Svg; svg: string }
  | { kind: Pasted.Image; file: F }
  | { kind: Pasted.Figma }
  | { kind: Pasted.Text; text: string };

export const HTML_MIME = 'text/html';
export const TEXT_MIME = 'text/plain';
export const SVG_MIME = 'image/svg+xml';

const PAYLOAD_ATTR = 'data-feega-clipboard';
const PAYLOAD = new RegExp(`${PAYLOAD_ATTR}="([A-Za-z0-9+/=]*)"`);
const FIGMA = /\(figma\)|\(figmeta\)/;
const SVG_MARKUP = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i;

function toBase64(text: string): string {
  return btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(''));
}

function fromBase64(code: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)));
}

export function clipboardHtml(payload: ClipboardPayload): string {
  return `<meta charset="utf-8"><span ${PAYLOAD_ATTR}="${toBase64(JSON.stringify(payload))}"></span>`;
}

function payloadOf(html: string): ClipboardPayload | null {
  const code = html.match(PAYLOAD)?.[1];
  if (!code) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64(code)) as ClipboardPayload;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function readPaste<F extends PasteFile>(source: PasteSource<F>): PasteData<F> | null {
  const payload = payloadOf(source.html);
  if (payload) {
    return { kind: Pasted.Feega, payload };
  }
  if (FIGMA.test(source.html)) {
    return { kind: Pasted.Figma };
  }
  if (SVG_MARKUP.test(source.text)) {
    return { kind: Pasted.Svg, svg: source.text };
  }
  const image = source.files.find((f) => f.type.startsWith('image/') && f.type !== SVG_MIME);
  if (image) {
    return { kind: Pasted.Image, file: image };
  }
  const text = source.text.trim();
  return text ? { kind: Pasted.Text, text } : null;
}
