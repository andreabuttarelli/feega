import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { llmStructured, type LlmMediaPart } from '$lib/server/llm';
import { TASTE_AXES, type Taste } from './score';

export const JUDGE_MODEL = 'anthropic/claude-sonnet-5.5';

const ANCHORS = join(import.meta.dirname, 'anchors');

const AXIS = { type: 'object', properties: { score: { type: 'integer', minimum: 1, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'], additionalProperties: false };

const SCHEMA = { type: 'object', properties: Object.fromEntries(TASTE_AXES.map((a) => [a, AXIS])), required: [...TASTE_AXES], additionalProperties: false };

const jpeg = (file: string): LlmMediaPart => ({ mediaType: 'image/jpeg', data: readFileSync(file).toString('base64') });

const anchors = (prefix: string) =>
  readdirSync(ANCHORS)
    .filter((f) => f.startsWith(prefix))
    .sort()
    .map((f) => jpeg(join(ANCHORS, f)));

const prompt = (good: number, bad: number, frames: number, brief: string) =>
  `You judge brand motion videos made by an AI agent. Calibration: the first ${good} images are stills from videos the owner rates 9/10 (premium, Apple-like, dense, dynamic, real product UI). The next ${bad} are stills from a video rated 3/10 (empty black frames, tiny generic placeholder cards, static, wireframe look). The last ${frames} images are evenly spaced stills of the video to judge, in order. The request was: "${brief}". Score that video 1-10 on: dynamism (sense of motion, variety between stills), hierarchy (clear focal point, readable type scale), density (frame filled with meaningful content; 1 = mostly empty), premium (would a top brand ship it), brandFidelity (looks like the real brand/product in the request, not a generic kit). One short concrete reason each, naming what you see.`;

export async function judge(frames: string[], brief: string): Promise<Taste> {
  const good = anchors('good-');
  const bad = anchors('bad-');
  return llmStructured<Taste>({ prompt: prompt(good.length, bad.length, frames.length, brief), schema: SCHEMA, model: JUDGE_MODEL, images: [...good, ...bad, ...frames.map(jpeg)], temperature: 0, label: 'eval.motion-judge' });
}
