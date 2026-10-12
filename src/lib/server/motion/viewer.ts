import { z } from 'zod';
import type { LlmMediaPart } from '$lib/server/llm';
import type { Frame } from './frames';
import type { FrameLine } from './look';

export const VIEWER_MODEL = 'anthropic/claude-sonnet-5.5';

const SEEN = z.object({ frames: z.array(z.object({ time: z.number(), visible: z.string().min(1), wrong: z.string().min(1) })) });

export const VIEWER_SCHEMA = z.toJSONSchema(SEEN) as Record<string, unknown>;

export type ViewerAsk = { prompt: string; images: LlmMediaPart[] };

export type ViewerPorts = { ask: (input: ViewerAsk) => Promise<{ answer: unknown; usd: number }> };

export type View = { lines: FrameLine[] | null; usd: number };

const prompt = (times: readonly number[]) =>
  [
    `You see ${times.length} stills from one video, in order, at ${times.map((t) => `${t}s`).join(', ')}.`,
    'Describe each one in one line, from the picture alone: visible = what is actually on screen (elements, exact words, colours, where they sit, how much of the frame is empty or plain white); wrong = what is wrong as seen (clipped or unreadable text, an empty or half-loaded frame, overlaps, a picture that has not loaded), or "nothing".',
    'Say what is there, not what should be there. No praise, no advice.'
  ].join('\n');

export async function viewFrames(ports: ViewerPorts, frames: readonly Frame[]): Promise<View> {
  const times = frames.map((f) => f.time);
  const images = frames.map((f) => ({ mediaType: 'image/jpeg', data: f.bytes.toString('base64') }));
  const { answer, usd } = await ports.ask({ prompt: prompt(times), images });
  const parsed = SEEN.safeParse(answer);
  return { lines: parsed.success ? parsed.data.frames : null, usd };
}

export function viewNote(lines: readonly FrameLine[]): string {
  return lines.map((l) => `${l.time}s: ${l.visible}. Wrong: ${l.wrong}`).join('\n');
}
