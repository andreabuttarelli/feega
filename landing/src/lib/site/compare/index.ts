import type { Competitor } from './tool';
import { FIGMA } from './tools/figma';
import { PENCIL_DEV } from './tools/pencil-dev';
import { FLORA } from './tools/flora';
import { CANVA } from './tools/canva';
import { GUI } from './tools/gui';

export const COMPARE_PATH = '/compare';

export const COMPARE_INDEX = {
  title: 'Feega compared: Figma, Canva, Pencil.dev and more',
  description: 'Honest comparisons of Feega, the open-source way to design in your codebase, vs Figma, Canva, Pencil.dev, Gui and Flora.',
  heading: 'Design tools, compared honestly',
  intro:
    'Each page says where the other tool is better, not only where Feega is. Every claim about another product links to its source and carries the date we checked it. If something is wrong or out of date, write to <a href="mailto:hi@feega.app">hi@feega.app</a> and we will fix it.'
} as const;

export const COMPARISONS: Readonly<Record<string, Competitor>> = {
  'figma': FIGMA,
  'pencil-dev': PENCIL_DEV,
  'flora': FLORA,
  'canva': CANVA,
  'gui': GUI
};

export const comparisonPath = (slug: string) => `${COMPARE_PATH}/${slug}`;

export function isComparisonSlug(slug: string): boolean {
  return Object.hasOwn(COMPARISONS, slug);
}
