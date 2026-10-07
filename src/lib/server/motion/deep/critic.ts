import { z } from 'zod';
import { TrackKind, COMPONENTS } from '$lib/motion/components';
import type { MotionDoc } from '$lib/motion/doc';
import type { DeepVerdict } from '$lib/motion/deep';

export const SAMPLE_STEP_S = 0.25;
export const CRITIC_SHOWN_MAX = 24;
export const PASS_SCORE = 8;
const MAX_FIXES = 10;
const EDGE_S = 0.1;
const CUT_SIDE_S = 0.25;
const STILL_DIFF = 1.5;
const STILL_MAX_S = 1;
const END_HOLD_S = 0.5;
const PRECISION = 100;

const round = (t: number) => Math.round(t * PRECISION) / PRECISION;

const secondsOf = (doc: MotionDoc) => doc.durationInFrames / doc.fps;

export function sampleTimes(doc: MotionDoc): number[] {
  const end = secondsOf(doc) - EDGE_S;
  const count = Math.floor(end / SAMPLE_STEP_S);
  return Array.from({ length: count }, (_, i) => round((i + 1) * SAMPLE_STEP_S));
}

function cutTimes(doc: MotionDoc): number[] {
  const end = secondsOf(doc);
  const edges = doc.tracks
    .filter((t) => t.kind === TrackKind.Visual)
    .flatMap((t) => t.clips.filter((c) => COMPONENTS[c.component]?.track === TrackKind.Visual))
    .flatMap((c) => [c.from, c.from + c.durationInFrames].map((f) => round(f / doc.fps)));
  return [...new Set(edges)].filter((t) => t > EDGE_S && t < end - EDGE_S).sort((a, b) => a - b);
}

const nearest = (samples: number[], t: number) => samples.reduce((best, s) => (Math.abs(s - t) < Math.abs(best - t) ? s : best), samples[0]);

function evenly(times: number[], max: number): number[] {
  if (times.length <= max) {
    return times;
  }
  const step = (times.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => times[Math.round(i * step)]);
}

export function critiqueTimes(doc: MotionDoc, samples: number[]): number[] {
  const seconds = Array.from({ length: Math.floor(secondsOf(doc)) }, (_, s) => s + 0.5);
  const sides = cutTimes(doc).flatMap((cut) => [cut - CUT_SIDE_S, cut + CUT_SIDE_S]);
  const picked = [...new Set([...seconds, ...sides].map((t) => nearest(samples, t)))].sort((a, b) => a - b);
  return evenly(picked, CRITIC_SHOWN_MAX);
}

export type Signed = { time: number; signature: Uint8Array };

export type StillSpan = { from: number; to: number };

function difference(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

export function stillSpans(samples: readonly Signed[], seconds: number): StillSpan[] {
  const runs: StillSpan[] = [];
  let start: number | null = null;
  for (let i = 1; i <= samples.length; i++) {
    const still = i < samples.length && difference(samples[i - 1].signature, samples[i].signature) < STILL_DIFF;
    if (still) {
      start ??= samples[i - 1].time;
      continue;
    }
    if (start !== null) {
      runs.push({ from: start, to: samples[i - 1].time });
    }
    start = null;
  }
  return runs.filter((r) => r.to - r.from > STILL_MAX_S && r.to < seconds - END_HOLD_S - SAMPLE_STEP_S);
}

const verdictSchema = z.object({ score: z.number().min(0).max(10), pass: z.boolean(), fixes: z.array(z.string()).default([]) });

const UNREADABLE = 'the critic answer could not be read: look at the frames again and fix what reads badly';

export function parseVerdict(text: string, objective: string[]): DeepVerdict {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let parsed: z.infer<typeof verdictSchema> | null = null;
  try {
    const checked = verdictSchema.safeParse(JSON.parse(json));
    parsed = checked.success ? checked.data : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return { pass: false, score: 0, fixes: [...objective, UNREADABLE].slice(0, MAX_FIXES) };
  }
  return {
    pass: parsed.pass && parsed.score >= PASS_SCORE && objective.length === 0,
    score: parsed.score,
    fixes: [...objective, ...parsed.fixes].slice(0, MAX_FIXES)
  };
}

export const RUBRIC = [
  'Would a client pay for it? Judge it against the launch films of Apple, Linear and Vercel: minimal look, high energy, a wow moment. A tidy slideshow fails, however clean.',
  'Energy: kinetic typography that lands on the beat, every scene moving (push-ins, pans, devices flying and turning in 3D, camera moves), speed ramps into cuts, at least one match cut.',
  'The peak: one clear wow moment around two thirds in (the product big, the biggest move, the strongest beat), then a clean end card with the real website.',
  'Rhythm: a cut every 1–2.5 s, on the beat of the music; music is always there; nothing drags, nothing flashes by unread.',
  'Legibility: every line can be read on a phone in the time it is on screen; no text smaller than about 3% of the frame height; strong contrast.',
  'Hierarchy: one focal point per frame; headline over subline over detail; the eye knows where to go.',
  'No blank, half-loaded, blurry or pixelated frame; screenshots and logos crisp, never upscaled mush. No overflow: text inside the frame and its box, a 5% safe area.',
  `Nothing holds still for more than ${STILL_MAX_S} s.`,
  'Story: a hook in the first second, the real product shown big, the real name and claim. Style: the style rules below are respected.'
];

export function critiquePrompt(input: { storyboard: string; times: number[]; objective: string[]; styleRules: readonly string[] }): string {
  return [
    'You are the critic of a short motion video, a senior motion director at a top launch-film studio, with a hard eye. You get the storyboard, the frames rendered from the real video at the times listed, and the problems the automatic checks measured. The question is one: would a client pay for this?',
    `Frames, in order, at: ${input.times.map((t) => `${t}s`).join(', ')}.`,
    `Storyboard:\n${input.storyboard}`,
    input.objective.length ? `Measured problems (each one must be fixed):\n- ${input.objective.join('\n- ')}` : 'The automatic checks found nothing.',
    `Rubric:\n${RUBRIC.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    `Style rules:\n${input.styleRules.map((r) => `- ${r}`).join('\n')}`,
    `Score the video 0–10, where ${PASS_SCORE} means a client would pay for it as it is. A clean but static or slow video scores 5 at most. It passes only at ${PASS_SCORE} or more with no blocking problem left.`,
    `List at most ${MAX_FIXES} fixes, most important first, each concrete and actionable for the editor: the time, the scene or clip, what is wrong, and exactly what to change (e.g. "2.5–4.5 s, ui-closeup: the screenshot holds still and its text is unreadable: crop on the chart with focus_x 0.7, focus_y 0.4 and add a 1.04 push-in").`,
    'Answer with your reasoning, then the verdict as one JSON object: {"score": number, "pass": boolean, "fixes": string[]}.'
  ].join('\n\n');
}
