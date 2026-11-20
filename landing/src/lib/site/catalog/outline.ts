import { HUBS } from '../topics';
import { topicPath, type Topic } from '../topics/topic';
import { ALTERNATIVES, alternativePath } from '../alternatives';
import { ArticleKind, type Article } from '../alternatives/alternative';
import { KIND_HEADINGS } from '../alternatives';
import { slugify } from './slug';

export enum Depth {
  Section = 2,
  Sub = 3
}

export type OutlineItem = { readonly id: string; readonly text: string; readonly depth: Depth };

export type NavItem = { readonly href: string; readonly label: string };

export type NavGroup = { readonly label: string; readonly items: readonly NavItem[] };

const item = (text: string, depth: Depth = Depth.Section): OutlineItem => ({ id: slugify(text), text, depth });

export function articleOutline(article: Article): readonly OutlineItem[] {
  const rich = article.rich;

  return [
    ...(rich ? [item(rich.snapshotHeading), ...rich.highlights.map((h) => item(h.heading, Depth.Sub))] : []),
    item('When to choose which'),
    ...(rich ? [item(rich.cost.heading)] : []),
    ...article.sections.map((s) => item(s.heading)),
    item(rich?.stepsHeading ?? 'Try it in 2 minutes'),
    item('Mistakes people make'),
    item('Questions'),
    item('How we checked'),
    item('Read next')
  ];
}

export const topicOutline = (topic: Topic): readonly OutlineItem[] => [
  item('the short version'),
  ...topic.sections.map((s) => item(s.heading)),
  item('how we checked'),
  item('try it in 2 minutes'),
  item('mistakes people make'),
  item('questions'),
  item('sources'),
  item('read next')
];

export const NAV_GROUPS: readonly NavGroup[] = [
  ...Object.values(ArticleKind).map((kind) => ({
    label: `alternatives: ${KIND_HEADINGS[kind].toLowerCase()}`,
    items: Object.entries(ALTERNATIVES)
      .filter(([, a]) => a.kind === kind)
      .map(([slug, a]) => ({ href: alternativePath(slug), label: a.heading }))
  })),
  ...HUBS.map((hub) => ({
    label: hub.menuLabel,
    items: Object.entries(hub.topics).map(([slug, t]) => ({ href: topicPath(hub, slug), label: t.heading }))
  }))
];
