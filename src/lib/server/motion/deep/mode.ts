import { TurnMode } from '$lib/motion/deep';

export type ModeInput = { message: string; clips: number; requested: TurnMode | null };

type ModeRule = { mode: (input: ModeInput) => TurnMode; applies: (input: ModeInput) => boolean };

const NEW_VIDEO = /\b(make|create|build|produce|generate|design|direct|animate)(\s+(me|us))?\s+(a|an|one)\b[^.?!]{0,120}?\b(video|trailer|promo|showreel|reel|commercial|spot|explainer|teaser|ad)\b/i;
const BRIEF_WORDS = 20;

const words = (message: string) => message.trim().split(/\s+/).length;

const MODE_RULES: ModeRule[] = [
  { applies: (input) => input.requested !== null, mode: (input) => input.requested as TurnMode },
  { applies: (input) => NEW_VIDEO.test(input.message), mode: () => TurnMode.Deep },
  { applies: (input) => input.clips === 0 && words(input.message) >= BRIEF_WORDS, mode: () => TurnMode.Deep }
];

export function turnMode(input: ModeInput): TurnMode {
  return MODE_RULES.find((rule) => rule.applies(input))?.mode(input) ?? TurnMode.Quick;
}
