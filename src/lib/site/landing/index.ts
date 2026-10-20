import pages from './pages.json';

export type Cta = { readonly href: string; readonly label: string };
export type Figure = { readonly src: string; readonly alt: string };

export type LandingSection = {
  readonly heading: string;
  readonly html: string;
  readonly examples: readonly Figure[];
  readonly cta: Cta | null;
};

export type LandingPage = {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly intro: string;
  readonly cta: Cta;
  readonly hero: Figure;
  readonly heroHeight: number;
  readonly exampleHeight: number;
  readonly sections: readonly LandingSection[];
};

export const LANDING_PAGES: Readonly<Record<string, LandingPage>> = pages;

export function isLandingSlug(slug: string): boolean {
  return Object.hasOwn(LANDING_PAGES, slug);
}
