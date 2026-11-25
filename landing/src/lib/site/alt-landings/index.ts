import { CHECKED, CHECKED_LABEL, VARIANTS } from './variants';
import type { Variant } from './variant';

export { CHECKED, CHECKED_LABEL };

export const ALT_LANDINGS: readonly Variant[] = VARIANTS;

export const altLandingPath = (slug: string) => `/${slug}`;

export const ALT_LANDING_PATHS: readonly string[] = ALT_LANDINGS.map((v) => altLandingPath(v.slug));

export const isAltLandingSlug = (slug: string): boolean => ALT_LANDINGS.some((v) => v.slug === slug);

export const landingFor = (slug: string): Variant | undefined => ALT_LANDINGS.find((v) => v.slug === slug);

export const SEE_IT_LABEL = 'see it in action';

export const FULL_COMPARISON_LABEL = 'read the full comparison';

const WORD_BREAK = /\s+/;

export function wordsOf(v: Variant): number {
  const parts = [
    v.h1,
    v.subhead,
    v.keepTool,
    ...v.differentiators.flatMap((d) => [d.heading, d.text]),
    ...v.strip.flatMap((r) => [r.aspect, r.tool, r.feega]),
    ...v.faq.flatMap((f) => [f.q, f.a])
  ];

  return parts.join(' ').split(WORD_BREAK).filter(Boolean).length;
}
