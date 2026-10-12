import { cursorMath } from './shots/cursor';

export enum Sfx {
  Click = 'click',
  Key = 'key',
  Whoosh = 'whoosh'
}

export enum ShotSound {
  Off = 'off',
  On = 'on'
}

const CC0 = 'CC0-1.0';
const IN_HOUSE = 'feega, scripts/sfx/build-sfx.sh';

export type SfxFile = { sfx: Sfx; file: string; seconds: number; license: typeof CC0; author: string };

export const SFX_LIBRARY: Record<Sfx, SfxFile> = {
  [Sfx.Click]: { sfx: Sfx.Click, file: 'click.mp3', seconds: 0.08, license: CC0, author: IN_HOUSE },
  [Sfx.Key]: { sfx: Sfx.Key, file: 'key.mp3', seconds: 0.06, license: CC0, author: IN_HOUSE },
  [Sfx.Whoosh]: { sfx: Sfx.Whoosh, file: 'whoosh.mp3', seconds: 0.6, license: CC0, author: IN_HOUSE }
};

export const sfxLabel = (sfx: Sfx) => `sfx ${sfx}`;

export type SfxCue = { sfx: Sfx; at: number };

type CuedStep = { action: string; at: number; end: number; text: string };

const math = cursorMath();

const CUES: Record<string, (s: CuedStep) => SfxCue[]> = {
  click: (s) => [{ sfx: Sfx.Click, at: s.at }],
  type: (s) => [{ sfx: Sfx.Click, at: s.at }, ...math.keyTimes(s).map((at) => ({ sfx: Sfx.Key, at }))]
};

export function cursorCues(steps: readonly CuedStep[]): SfxCue[] {
  return steps.flatMap((s) => CUES[s.action]?.(s) ?? []).sort((a, b) => a.at - b.at);
}
