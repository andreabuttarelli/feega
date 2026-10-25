import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { InputKey } from '@feega/motion-core/motion/expression/inputs';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { liveLanes } from '@feega/motion-core/motion/interactive/spec';
import { PlayMode, interactiveOf } from '@feega/motion-core/motion/interactive/settings';

export enum Reaction {
  Cursor = 'cursor',
  Press = 'press',
  Hover = 'hover',
  Tilt = 'tilt',
  Scroll = 'scroll'
}

export const REACTION_LABEL: Record<Reaction, string> = {
  [Reaction.Cursor]: 'Follows the cursor',
  [Reaction.Press]: 'Reacts to clicks and taps',
  [Reaction.Hover]: 'Reacts to hover',
  [Reaction.Tilt]: 'Tilts with the phone',
  [Reaction.Scroll]: 'Reacts to scroll'
};

const INPUT_REACTION: Record<InputKey, Reaction | null> = {
  [InputKey.PointerX]: Reaction.Cursor,
  [InputKey.PointerY]: Reaction.Cursor,
  [InputKey.PointerDown]: Reaction.Press,
  [InputKey.Hover]: Reaction.Hover,
  [InputKey.TiltX]: Reaction.Tilt,
  [InputKey.TiltY]: Reaction.Tilt,
  [InputKey.Scroll]: Reaction.Scroll,
  [InputKey.Time]: null
};

const reads = (source: string, key: InputKey) => new RegExp(`\\binput\\s*\\.\\s*${key.replace('.', '\\s*\\.\\s*')}\\b`).test(source);

export function reactionsOf(doc: MotionDoc): Reaction[] {
  const flat = flattenComps(doc);
  const live = new Set(liveLanes(flat).map((l) => `${l.id}.${l.key}`));
  const sources = clipsOf(flat).flatMap((c) => Object.entries(c.expressions).filter(([key]) => live.has(`${c.id}.${key}`)).map(([, source]) => source));
  const found = new Set<Reaction>();

  for (const [key, reaction] of Object.entries(INPUT_REACTION) as [InputKey, Reaction | null][]) {
    if (reaction && sources.some((s) => reads(s, key))) {
      found.add(reaction);
    }
  }

  if (interactiveOf(doc).playback === PlayMode.Scrub) {
    found.add(Reaction.Scroll);
  }

  return Object.values(Reaction).filter((r) => found.has(r));
}
