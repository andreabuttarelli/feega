import { ArticleKind, type Article } from './alternative';
import { ROUNDUPS } from './roundups';
import { SINGLES } from './singles';

export const ALTERNATIVES_PATH = '/alternatives';

export const ALTERNATIVES_INDEX = {
  title: 'Design tool alternatives for teams with a codebase | Feega',
  description: 'Visual editors, AI site builders and design tools compared for teams whose product already exists. Side by side, with a date and a source on every claim.',
  heading: 'Alternatives and comparisons',
  intro: 'Side by side, with a date and a source on every claim. Where another tool fits you better, the page says so.'
} as const;

export const KIND_HEADINGS: Readonly<Record<ArticleKind, string>> = {
  [ArticleKind.Roundup]: 'Side by side',
  [ArticleKind.UseCase]: 'Situations',
  [ArticleKind.Single]: 'Alternatives to one tool'
};

export const TRY_STEPS: readonly string[] = [
  'Open a project folder in Feega, or import a GitHub repo in the browser.',
  'Pick a page. Feega runs your app and shows it on the canvas.',
  'Change a heading, a colour or a spacing.',
  'Read the diff, then commit or open a pull request.'
];

export const ALTERNATIVES: Readonly<Record<string, Article>> = { ...ROUNDUPS, ...SINGLES };

export const alternativePath = (slug: string) => `${ALTERNATIVES_PATH}/${slug}`;

export function isAlternativeSlug(slug: string): boolean {
  return Object.hasOwn(ALTERNATIVES, slug);
}
