import type { EditorShotId } from '../editor-shots';

export type Figure = { readonly src: string; readonly alt: string; readonly width: number; readonly height: number };

export type Question = { readonly q: string; readonly a: string };

export type Source = { readonly label: string; readonly href: string };

export type Section = { readonly heading: string; readonly html: string; readonly figure?: Figure; readonly editor?: EditorShotId };


export type Topic = {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly hook: string;
  readonly short: string;
  readonly cover: Figure;
  readonly sections: readonly Section[];
  readonly checked: string;
  readonly howChecked: string;
  readonly tryIt: readonly string[];
  readonly mistakes: readonly Question[];
  readonly questions: readonly Question[];
  readonly sources: readonly Source[];
  readonly readNext: readonly string[];
};

export type Hub = {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly menuLabel: string;
  readonly intro: string;
  readonly topics: Readonly<Record<string, Topic>>;
};

export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 675;

export const figure = (src: string, alt: string, size = { width: IMAGE_WIDTH, height: IMAGE_HEIGHT }): Figure => ({ src, alt, ...size });

export const topicPath = (hub: Hub, slug: string) => `${hub.path}/${slug}`;

const tagless = (html: string) => html.replace(/<[^>]+>/g, ' ');

export function topicText(topic: Topic): string {
  return [
    topic.heading,
    topic.short,
    ...topic.sections.flatMap((s) => [s.heading, tagless(s.html)]),
    tagless(topic.howChecked),
    ...topic.tryIt,
    ...topic.mistakes.flatMap((m) => [m.q, m.a]),
    ...topic.questions.flatMap((m) => [m.q, m.a])
  ].join('\n');
}

export const wordsIn = (text: string) => text.split(/\s+/).filter((w) => /\w/.test(w)).length;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function spokenDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
