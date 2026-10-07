import { z } from 'zod';
import { UI_STRUCTURE } from '$lib/motion/ui-kit/kit';
import type { LlmMediaPart } from '$lib/server/llm';
import type { MotionAsset } from './editor';
import type { UiRead, UiRegion } from './motion-tools';

export type UiAsk = (input: { prompt: string; schema: Record<string, unknown>; images: LlmMediaPart[] }) => Promise<unknown>;

export type UiReaderPorts = { ask: UiAsk; fetchBytes: (url: string) => Promise<LlmMediaPart> };

const SCHEMA = z.toJSONSchema(UI_STRUCTURE) as Record<string, unknown>;

const percent = (n: number) => `${Math.round(n * 100)}%`;

const regionNote = (r?: UiRegion) => (r ? ` Read only the region from ${percent(r.x)} to ${percent(r.x + r.width)} across and ${percent(r.y)} to ${percent(r.y + r.height)} down.` : '');

const PROMPT =
  'This is a capture of a product website or app. Describe its UI as a simplified structure to rebuild it as clean vector UI: the layout, up to 12 blocks top to bottom (nav, heading, text, input, button, stat, card, list, picture) with their REAL texts copied exactly, the colours as #rrggbb (ink text, muted text, paper background, line borders, accent: the brand colour of buttons and links), the font family and the corner radius in px.';

export function uiReader(ports: UiReaderPorts) {
  return async (asset: MotionAsset, region?: UiRegion): Promise<UiRead> => {
    try {
      const image = await ports.fetchBytes(asset.url ?? asset.previewUrl);
      const answer = await ports.ask({ prompt: PROMPT + regionNote(region), schema: SCHEMA, images: [image] });
      const parsed = UI_STRUCTURE.safeParse(answer);
      return parsed.success ? { ok: true, structure: parsed.data } : { ok: false, error: `the capture was read into an invalid structure: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` };
    } catch (e) {
      return { ok: false, error: `the capture could not be read: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
}

export async function fetchImageBytes(url: string): Promise<LlmMediaPart> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`picture download failed (${res.status})`);
  }
  return { mediaType: res.headers.get('content-type') ?? 'image/png', data: Buffer.from(await res.arrayBuffer()).toString('base64') };
}
