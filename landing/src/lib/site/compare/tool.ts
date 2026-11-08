import type { FeatureTable } from './features';

export type Source = { readonly label: string; readonly href: string };

export type Section = { readonly heading: string; readonly html: string };

export type Competitor = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly intro: string;
  readonly pricing: string;
  readonly features: FeatureTable;
  readonly theyWin: readonly string[];
  readonly feegaWins: readonly string[];
  readonly pickThem: string;
  readonly pickFeega: string;
  readonly sections: readonly Section[];
  readonly sources: readonly Source[];
  readonly faq?: readonly { readonly q: string; readonly a: string }[];
  readonly checked: string;
};
