import { readFileSync } from 'node:fs';
import { llmStructured, type LlmMediaPart } from '$lib/server/llm';
import { JUDGE_MODEL } from '../motion-quality/judge';

export enum Arm {
  Plain = 'plain',
  Feega = 'feega'
}

export enum Pick {
  First = 'first',
  Second = 'second',
  Tie = 'tie'
}

export enum Outcome {
  FeegaWins = 'feega',
  PlainWins = 'plain',
  Tie = 'tie',
  Inconsistent = 'inconsistent'
}

export type Side = { fidelity: number; legible: boolean };
export type PairVerdict = { winner: Pick; reason: string; first: Side; second: Side };
export type ArmVerdict = { winner: Arm | null; reason: string; sides: Record<Arm, Side> };

const SIDE = { type: 'object', properties: { fidelity: { type: 'integer', minimum: 1, maximum: 10 }, legible: { type: 'boolean' } }, required: ['fidelity', 'legible'], additionalProperties: false };

export const SCHEMA = {
  type: 'object',
  properties: { winner: { type: 'string', enum: Object.values(Pick) }, reason: { type: 'string' }, first: SIDE, second: SIDE },
  required: ['winner', 'reason', 'first', 'second'],
  additionalProperties: false
};

export const RUBRIC = `House rubric (premium brand motion, Apple/Linear/Vercel launch-film spirit):
- Real motion energy: kinetic type, camera moves, one clear peak; never a slideshow or PowerPoint (no bouncing/flying text, spins, decorative glows or particles).
- Strong in-out expo easing landing softly; animations finish and HOLD 1-1.5 s before a cut; scenes 2-4 s; never rushed.
- Little text: few words, a title owns the frame, big and centred, semibold with tight tracking; words and pictures take turns, never a headline over a busy UI.
- Product UI shown one element at a time, large, faithful; never empty boxes or tiny placeholder cards.
- Frame filled with meaningful content; no empty or black frames; nothing clipped; the last frame is content.
- Brief fidelity: does it do what was asked (format, length, assets used, brand colours, loop if asked)?`;

const prompt = (brief: string, firstCount: number) =>
  `Two AI tools answered the same request. Request: "${brief}"\n\n${RUBRIC}\n\nThe first ${firstCount} images are a contact sheet (1 still per second) then evenly spaced stills of video FIRST, in order. The remaining images are the same for video SECOND. Judge which video is better overall by the rubric and fidelity to the request. Pick "tie" only if genuinely equal. Also score each video's brief fidelity 1-10 and whether all its on-screen text is legible on a phone. Reason: one or two concrete sentences naming what you see.`;

const jpeg = (file: string): LlmMediaPart => ({ mediaType: 'image/jpeg', data: readFileSync(file).toString('base64') });

export type Shots = { sheet: string; frames: string[] };

const shotParts = (s: Shots) => [jpeg(s.sheet), ...s.frames.map(jpeg)];

export function judgePair(brief: string, first: Shots, second: Shots): Promise<PairVerdict> {
  const a = shotParts(first);
  return llmStructured<PairVerdict>({ prompt: prompt(brief, a.length), schema: SCHEMA, model: JUDGE_MODEL, images: [...a, ...shotParts(second)], temperature: 0, label: 'eval.versus-judge' });
}

export function toArms(v: PairVerdict, firstArm: Arm): ArmVerdict {
  const secondArm = firstArm === Arm.Plain ? Arm.Feega : Arm.Plain;
  const winner = v.winner === Pick.Tie ? null : v.winner === Pick.First ? firstArm : secondArm;
  return { winner, reason: v.reason, sides: { [firstArm]: v.first, [secondArm]: v.second } as Record<Arm, Side> };
}

export function settle(a: ArmVerdict, b: ArmVerdict): Outcome {
  if (a.winner !== b.winner) {
    return Outcome.Inconsistent;
  }
  return a.winner === Arm.Feega ? Outcome.FeegaWins : a.winner === Arm.Plain ? Outcome.PlainWins : Outcome.Tie;
}

export function byForfeit(exists: Record<Arm, boolean>): Outcome | null {
  if (exists.feega && exists.plain) {
    return null;
  }
  if (exists.feega) {
    return Outcome.FeegaWins;
  }
  return exists.plain ? Outcome.PlainWins : Outcome.Tie;
}
