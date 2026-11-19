import type { LogoKey } from './logos';

export enum ArticleKind {
  Roundup = 'roundup',
  UseCase = 'use-case',
  Single = 'single'
}

export type Question = { readonly q: string; readonly a: string };

export type Source = { readonly label: string; readonly href: string };

export type Section = { readonly heading: string; readonly html: string };

export type Article = {
  readonly kind: ArticleKind;
  readonly logo?: LogoKey;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly hook: string;
  readonly lead: string;
  readonly pickThem: { readonly name: string; readonly points: readonly string[] };
  readonly pickFeega: readonly string[];
  readonly sections: readonly Section[];
  readonly mistakes: readonly Question[];
  readonly questions: readonly Question[];
  readonly sources: readonly Source[];
  readonly checked: string;
};

export function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const th = head.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map(([first, ...cells]) => `<tr><th scope="row">${first}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
