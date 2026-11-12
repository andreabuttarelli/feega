import type { Competitor } from './tool';
import { AFTER_EFFECTS } from './tools/after-effects';
import { JITTER } from './tools/jitter';
import { REMOTION } from './tools/remotion';
import { RIVE } from './tools/rive';
import { FIGMA } from './tools/figma';
import { PENCIL_DEV } from './tools/pencil-dev';
import { FLORA } from './tools/flora';
import { CANVA } from './tools/canva';
import { GUI } from './tools/gui';

export const COMPARE_PATH = '/compare';

export const COMPARE_INDEX = {
  title: 'Feega compared: Figma, Jitter, After Effects, Canva and more',
  description: 'Honest comparisons of Feega, the open-source canvas to design, animate and generate, vs Figma, Jitter, After Effects, Pencil.dev, Flora, Rive, Canva, Remotion.',
  heading: 'Motion design tools, compared honestly',
  intro:
    'Each page says where the other tool is better, not only where Feega is. Every claim about another product links to its source and carries the date we checked it. If something is wrong or out of date, write to <a href="mailto:hi@feega.app">hi@feega.app</a> and we will fix it.'
} as const;

export const COMPARISONS: Readonly<Record<string, Competitor>> = {
  'figma': FIGMA,
  'jitter': JITTER,
  'remotion': REMOTION,
  'after-effects': AFTER_EFFECTS,
  'pencil-dev': PENCIL_DEV,
  'flora': FLORA,
  'rive': RIVE,
  'canva': CANVA,
  'gui': GUI
};

export const comparisonPath = (slug: string) => `${COMPARE_PATH}/${slug}`;

export function isComparisonSlug(slug: string): boolean {
  return Object.hasOwn(COMPARISONS, slug);
}
