import type { Guide } from './guide';
import { ANIMATE_UI } from './animate-ui';
import { CLAUDE_CODE_VIDEOS } from './claude-code-videos';
import { LAUNCH_VIDEO } from './launch-video';

export const GUIDES_PATH = '/guides';

export const GUIDES_INDEX = {
  title: 'Guides: motion design with Claude Code and AI agents',
  description: 'Answer-first guides on making videos and animating UIs with Claude Code and other AI agents.',
  heading: 'Motion design with AI agents',
  intro: 'Short answers first, then the steps. Competitor facts are cited with the date checked; Feega facts come from its open-source repository.'
} as const;

export const GUIDES: Readonly<Record<string, Guide>> = {
  'can-claude-code-make-videos': CLAUDE_CODE_VIDEOS,
  'launch-video-with-claude-code': LAUNCH_VIDEO,
  'animate-ui-with-ai-agent': ANIMATE_UI
};

export const guidePath = (slug: string) => `${GUIDES_PATH}/${slug}`;

export const isGuideSlug = (slug: string) => Object.hasOwn(GUIDES, slug);
