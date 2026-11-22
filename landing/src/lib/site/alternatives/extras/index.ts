import type { Extras } from '../alternative';
import { FRAMER_CLAUDE_CODE, FRAMER_CODEX, FRAMER_CURSOR } from './framer-pairs';
import { FRAMER_HUB, LOVABLE_HUB } from './hubs';
import { LOVABLE_CLAUDE_CODE, LOVABLE_CODEX, LOVABLE_CURSOR } from './lovable-pairs';

export const EXTRAS: Readonly<Record<string, Extras>> = {
  lovable: LOVABLE_HUB,
  framer: FRAMER_HUB,
  'lovable-alternative-for-claude-code': LOVABLE_CLAUDE_CODE,
  'lovable-alternative-for-codex': LOVABLE_CODEX,
  'lovable-alternative-for-cursor': LOVABLE_CURSOR,
  'framer-alternative-for-claude-code': FRAMER_CLAUDE_CODE,
  'framer-alternative-for-codex': FRAMER_CODEX,
  'framer-alternative-for-cursor': FRAMER_CURSOR
};
