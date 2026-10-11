import { z } from 'zod';
import type { ModelMessage } from 'ai';
import type { MotionDoc } from '$lib/motion/doc';
import type { LlmMediaPart } from '$lib/server/llm';
import { MAX_FRAMES_PER_VIEW, VIEW_FRAMES, type Frame, type Reference } from './frames';
import { scriptLines } from '$lib/motion/script';
import { EMPTY_EDGE_DENSITY } from '$lib/motion/emptiness';

export const SHEET_MAX_FRAMES = 24;
export const CRITIC_PASS_SCORE = 8;
const MAX_FIXES = 6;

const REVIEW = z.object({ score: z.number().int().min(1).max(10), fixes: z.array(z.string().min(1)).max(MAX_FIXES) });

export type CriticReview = z.infer<typeof REVIEW>;

export const CRITIC_SCHEMA = z.toJSONSchema(REVIEW) as Record<string, unknown>;

export type CriticAsk = { prompt: string; images: LlmMediaPart[] };

export type CriticPorts = {
  frames: (times: number[]) => Promise<Frame[] | null>;
  tile: (frames: readonly Frame[]) => Promise<Buffer>;
  ask: (input: CriticAsk) => Promise<{ answer: unknown; usd: number }>;
  density?: (frames: readonly Frame[]) => Promise<number[]>;
};

export type CriticInput = { doc: MotionDoc; request: string; references: readonly Reference[] };

export type Critique = { review: CriticReview | null; usd: number; sheet: Buffer | null };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sheetTimes(doc: Pick<MotionDoc, 'durationInFrames' | 'fps'>): number[] {
  const seconds = doc.durationInFrames / doc.fps;
  const count = Math.min(SHEET_MAX_FRAMES, Math.max(1, Math.floor(seconds)));
  const step = seconds / count;
  return Array.from({ length: count }, (_, i) => round1(step * i + step / 2));
}

const prompt = (input: CriticInput, times: number[]) =>
  [
    'You are the independent critic of a brand motion video made by another agent. You did not make it; judge it like a creative director before it ships.',
    `The first image is the contact sheet of the WHOLE video: ${times.length} stills, left to right then top to bottom, at ${times.join(', ')} s.`,
    input.references.length ? `The next ${input.references.length} images are the references the video should follow.` : '',
    `The request was: "${input.request}".`,
    input.doc.script ? `The on-screen lines, read in order: ${scriptLines(input.doc.script).map((l, i) => `${i + 1}. ${l}`).join(' ')}. Judge them first as text: do they make sense in that order, say something true and specific about the product, and lead to the promise? A line that does not is your first fix, with the replacement line.` : '',
    input.doc.script ? `The research behind them: ${JSON.stringify(input.doc.script.research)}` : '',
    'Score it 1-10 (premium, dense, dynamic, true to the real brand and product, readable hierarchy, follows the brief and the references).',
    `Then list at most ${MAX_FIXES} concrete fixes, worst first, each naming the time in seconds and the exact change (e.g. "2.5s: the frame is mostly empty: put the real dashboard UI behind the title"). No praise, no vague advice. An empty list if nothing must change.`
  ]
    .filter(Boolean)
    .join('\n');

const emptyFix = (time: number) => `${time}s: the frame is mostly empty: fill it with the recreated product UI (a ui-focus or whip-zoom on its elements) or make the one element on it large enough to hold the frame`;

export function withEmptyFrames(review: CriticReview, empty: readonly number[]): CriticReview {
  if (!empty.length) {
    return review;
  }
  return { score: Math.min(review.score, CRITIC_PASS_SCORE - 1), fixes: [...empty.map(emptyFix), ...review.fixes].slice(0, MAX_FIXES) };
}

export async function critique(ports: CriticPorts, input: CriticInput): Promise<Critique> {
  const times = sheetTimes(input.doc);
  const batches = Array.from({ length: Math.ceil(times.length / MAX_FRAMES_PER_VIEW) }, (_, i) => times.slice(i * MAX_FRAMES_PER_VIEW, (i + 1) * MAX_FRAMES_PER_VIEW));
  const drawn = [];
  for (const batch of batches) {
    drawn.push(await ports.frames(batch));
  }
  const frames = drawn.every(Boolean) ? drawn.flatMap((d) => d ?? []) : null;
  if (!frames?.length) {
    return { review: null, usd: 0, sheet: null };
  }

  const sheet = await ports.tile(frames);
  const images: LlmMediaPart[] = [{ mediaType: 'image/jpeg', data: sheet.toString('base64') }, ...input.references.map((r) => ({ mediaType: r.mediaType, data: r.data }))];
  const { answer, usd } = await ports.ask({ prompt: prompt(input, times), images });

  const parsed = REVIEW.safeParse(answer);
  if (!parsed.success) {
    return { review: null, usd, sheet };
  }
  const densities = ports.density ? await ports.density(frames) : [];
  const empty = frames.filter((_, i) => densities[i] !== undefined && densities[i] < EMPTY_EDGE_DENSITY).map((f) => f.time);
  return { review: withEmptyFrames(parsed.data, empty), usd, sheet };
}

export function criticMessage(review: CriticReview): ModelMessage | null {
  if (review.score >= CRITIC_PASS_SCORE || !review.fixes.length) {
    return null;
  }
  const list = review.fixes.map((f) => `- ${f}`).join('\n');
  return {
    role: 'user',
    content: `An independent critic reviewed the full contact sheet and scored the video ${review.score}/10. Apply these fixes with the editing tools, worst first:\n${list}\nThen call ${VIEW_FRAMES} on the times you changed to check them, and as your last message write the user a short summary of the video as it now stands.`
  };
}
