import type { Competitor } from './tool';
import { AFTER_EFFECTS } from './tools/after-effects';
import { JITTER } from './tools/jitter';
import { REMOTION } from './tools/remotion';
import { RIVE } from './tools/rive';

export const BLOG_PATH = '/blog';

export const BLOG_INDEX = {
  title: 'Motion design tools compared: Feega, Jitter, Rive',
  description: 'Honest comparisons between Feega and Jitter, Remotion, After Effects and Rive: what each does better and who should pick which.',
  heading: 'Motion design tools, compared honestly',
  intro:
    'Each page says where the other tool is better, not only where Feega is. Every claim about another product links to its source and carries the date we checked it. If something is wrong or out of date, write to <a href="mailto:hi@feega.app">hi@feega.app</a> and we will fix it.'
} as const;

export const COMPARISONS: Readonly<Record<string, Competitor>> = {
  'feega-vs-jitter': JITTER,
  'feega-vs-remotion': REMOTION,
  'feega-vs-after-effects': AFTER_EFFECTS,
  'feega-vs-rive': RIVE
};

export const comparisonPath = (slug: string) => `${BLOG_PATH}/${slug}`;

export function isComparisonSlug(slug: string): boolean {
  return Object.hasOwn(COMPARISONS, slug);
}
