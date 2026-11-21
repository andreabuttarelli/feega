import type { Rich } from '../alternative';
import { CLAUDE_DESIGN } from './claude-design';
import { CURSOR_DESIGN_MODE } from './cursor-design-mode';
import { FIGMA } from './figma';
import { FRAMER } from './framer';
import { AGENT_RICH } from '../agents';
import { LOVABLE } from './lovable';
import { ONLOOK } from './onlook';
import { STITCH } from './stitch';
import { V0 } from './v0';
import { AI_BUILDER_OR_REPO, DESIGN_HANDOFF, DESIGN_WITH_CLAUDE_CODE, FIREBASE_STUDIO, VISUAL_EDITORS } from './roundups';

export const RICH: Readonly<Record<string, Rich>> = {
  'claude-design': CLAUDE_DESIGN,
  'cursor-design-mode': CURSOR_DESIGN_MODE,
  figma: FIGMA,
  framer: FRAMER,
  lovable: LOVABLE,
  onlook: ONLOOK,
  stitch: STITCH,
  v0: V0,
  'visual-editor-for-your-codebase': VISUAL_EDITORS,
  'ai-site-builder-or-your-repo': AI_BUILDER_OR_REPO,
  'design-handoff': DESIGN_HANDOFF,
  'design-with-claude-code': DESIGN_WITH_CLAUDE_CODE,
  'firebase-studio-shutting-down': FIREBASE_STUDIO,
  ...AGENT_RICH
};
