import { marketingUrl } from '$lib/marketing';

export const CURRENT_TERMS_VERSION = '2026-09-30';

export type LegalLinkKey =
  | 'terms'
  | 'privacy'
  | 'cookies';

export const LEGAL_LINKS: Record<LegalLinkKey, { path: string; labelKey: string }> = {
  terms: { path: '/terms', labelKey: 'legal.terms' },
  privacy: { path: '/privacy', labelKey: 'legal.privacy' },
  cookies: { path: '/cookies', labelKey: 'legal.cookies' }
};

/** L'ordine del footer app e del sottomenu Legal — le quattro citate nel modulo di accesso vengono prima. */
export const FOOTER_LEGAL_LINKS: LegalLinkKey[] = [
  'terms',
  'privacy',
  'cookies'
];

export function legalHref(key: LegalLinkKey): string {
  return marketingUrl(LEGAL_LINKS[key].path);
}
