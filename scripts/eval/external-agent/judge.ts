import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ANCHORS_DIR, JUDGE_MAX_TOKENS, JUDGE_MODEL, OPENROUTER_URL } from './config';

export const TASTE_AXES = ['dynamism', 'hierarchy', 'density', 'premium', 'brandFidelity'] as const;

export type Taste = Record<(typeof TASTE_AXES)[number], { score: number; reason: string }>;

export type Judged = { taste: Taste; costUsd: number };

const AXIS = { type: 'object', properties: { score: { type: 'integer', minimum: 1, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'], additionalProperties: false };

const SCHEMA = { type: 'object', properties: Object.fromEntries(TASTE_AXES.map((a) => [a, AXIS])), required: [...TASTE_AXES], additionalProperties: false };

const imagePart = (base64: string) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } });

const anchors = (prefix: string): string[] =>
  readdirSync(ANCHORS_DIR)
    .filter((f) => f.startsWith(prefix))
    .sort()
    .map((f) => readFileSync(join(ANCHORS_DIR, f)).toString('base64'));

const prompt = (good: number, bad: number, frames: number, brief: string) =>
  `You judge brand motion videos made by an AI agent. Calibration: the first ${good} images are stills from videos the owner rates 9/10 (premium, Apple-like, dense, dynamic, real product UI). The next ${bad} are stills from a video rated 3/10 (empty black frames, tiny generic placeholder cards, static, wireframe look). The last ${frames} images are evenly spaced stills of the video to judge, in order. The request was: "${brief}". Score that video 1-10 on: dynamism (sense of motion, variety between stills), hierarchy (clear focal point, readable type scale), density (frame filled with meaningful content; 1 = mostly empty), premium (would a top brand ship it), brandFidelity (looks like the real brand/product in the request, not a generic kit). One short concrete reason each, naming what you see.`;

export async function judgeFrames(frames: string[], brief: string): Promise<Judged> {
  const good = anchors('good-');
  const bad = anchors('bad-');
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      max_tokens: JUDGE_MAX_TOKENS,
      usage: { include: true },
      response_format: { type: 'json_schema', json_schema: { name: 'taste', strict: true, schema: SCHEMA } },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt(good.length, bad.length, frames.length, brief) }, ...[...good, ...bad, ...frames].map(imagePart)] }]
    })
  });
  const body = (await response.json()) as { choices?: { message: { content: string } }[]; usage?: { cost?: number }; error?: { message: string } };
  if (!response.ok || !body.choices?.[0]) {
    throw new Error(`judge ${response.status}: ${body.error?.message ?? 'no answer'}`);
  }
  return { taste: JSON.parse(body.choices[0].message.content) as Taste, costUsd: body.usage?.cost ?? 0 };
}
