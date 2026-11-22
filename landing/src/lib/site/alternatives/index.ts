import { ArticleKind, type Article } from './alternative';
import { AGENT_ARTICLES } from './agents';
import { EXTRAS } from './extras';
import { ROUNDUPS } from './roundups';
import { RICH } from './rich';
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
  [ArticleKind.Single]: 'Alternatives to one tool',
  [ArticleKind.Agent]: 'Alternatives for your coding agent'
};

export const TRY_STEPS: readonly string[] = [
  'Install Feega in VS Code, or run `npx feega` in your project folder.',
  'Open your project. Feega starts your dev server.',
  'Click an element and change it.',
  'See the diff in Changes, then keep it or undo it.'
];

const withRich = ([slug, article]: [string, Article]): [string, Article] => {
  const base = RICH[slug];
  const extras = EXTRAS[slug];
  const rich = base && extras ? { ...base, takeaways: extras.takeaways, tables: extras.tables, hero: extras.hero } : base;
  const kept = article.sections.filter((s) => !rich?.highlights.some((h) => h.heading === s.heading));
  const known = new Set(article.sources.map((s) => s.href));

  return [
    slug,
    {
      ...article,
      rich,
      sections: [...kept, ...(extras?.sections ?? [])],
      questions: [...article.questions, ...(rich?.moreQuestions ?? [])],
      sources: [...article.sources, ...(extras?.sources.filter((s) => !known.has(s.href)) ?? [])]
    }
  ];
};

export const ALTERNATIVES: Readonly<Record<string, Article>> = Object.fromEntries(Object.entries({ ...ROUNDUPS, ...SINGLES, ...AGENT_ARTICLES }).map(withRich));

export const alternativePath = (slug: string) => `${ALTERNATIVES_PATH}/${slug}`;

export function isAlternativeSlug(slug: string): boolean {
  return Object.hasOwn(ALTERNATIVES, slug);
}

export const AUTHOR = { name: 'Andrea Buttarelli', role: 'founder of Feega' } as const;

export const DISCLAIMER =
  'Feega is not affiliated with, endorsed by, sponsored by or connected to any company or product named on this page. All product names, logos and trademarks belong to their respective owners and are used only to identify those products. Information comes from their public pages on the date shown and may have changed since; check the source before you decide. This page is not legal, financial or purchasing advice.';
