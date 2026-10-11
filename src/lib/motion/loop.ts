import type { MotionDoc } from './doc';
import { PlayMode, interactiveOf } from './interactive/settings';
import { MotionStyle } from './style-model';

export enum Ending {
  LoopOff = 'loop-off',
  Scrub = 'scrub',
  Reel = 'reel',
  EndCard = 'end-card',
  Seamless = 'seamless'
}

export const LOOP_SEAM_LUMA = 12;

const END_CARD_TEMPLATE = 'end-card';

type LoopDoc = Pick<MotionDoc, 'interactive' | 'style' | 'comps' | 'tracks' | 'durationInFrames'>;

function endsOnCard(doc: LoopDoc): boolean {
  const last = doc.durationInFrames - 1;
  return doc.tracks.some((t) => t.clips.some((c) => c.component === 'Precomp' && c.from <= last && c.from + c.durationInFrames > last && doc.comps[String(c.props.comp)]?.template?.id === END_CARD_TEMPLATE));
}

const ENDINGS: readonly { ending: Ending; when: (doc: LoopDoc) => boolean; seamChecked: boolean }[] = [
  { ending: Ending.LoopOff, when: (doc) => !interactiveOf(doc).loop, seamChecked: false },
  { ending: Ending.Scrub, when: (doc) => interactiveOf(doc).playback === PlayMode.Scrub, seamChecked: false },
  { ending: Ending.Reel, when: (doc) => doc.style === MotionStyle.UiMorph, seamChecked: false },
  { ending: Ending.EndCard, when: endsOnCard, seamChecked: false },
  { ending: Ending.Seamless, when: () => true, seamChecked: true }
];

const rowOf = (doc: LoopDoc) => ENDINGS.find((row) => row.when(doc))!;

export const endingOf = (doc: LoopDoc): Ending => rowOf(doc).ending;

export const seamChecked = (doc: LoopDoc): boolean => rowOf(doc).seamChecked;

export function loopJump(doc: LoopDoc, lumaDiff: number): string | null {
  if (!seamChecked(doc) || lumaDiff < LOOP_SEAM_LUMA) {
    return null;
  }
  return `the last frame jumps to the first when the video loops (${Math.round(lumaDiff)} luma apart): end on the opening state (same background, the opening element back in its place) or on a match cut to frame 0 (same shape, position and colour)`;
}

export const LOOP_RULE =
  'Videos loop by default: embeds and social feeds replay them, so the last frame must flow into the first. Plan the ending with the opening in mind: return to the opening state (same background, the opening element back in its place) or end on a match cut to frame 0 (same shape, position and colour). Exceptions: a call-to-action end card (the end-card template), a reel that already loops, or a user who turned looping off. The loop-jump warning in view_frames names a last frame that jumps to the first.';
