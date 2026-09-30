export const LEGAL_BASE_URL = 'https://feega.app';

export const CURRENT_TERMS_VERSION = '2026-09-30';

export type LegalLinkKey =
  | 'terms'
  | 'acceptableUse'
  | 'privacy'
  | 'cookies'
  | 'refunds'
  | 'aiTransparency'
  | 'dpa'
  | 'subprocessors'
  | 'legalNotice';

export const LEGAL_LINKS: Record<LegalLinkKey, { path: string; labelKey: string }> = {
  terms: { path: '/terms', labelKey: 'legal.terms' },
  acceptableUse: { path: '/acceptable-use', labelKey: 'legal.acceptableUse' },
  privacy: { path: '/privacy', labelKey: 'legal.privacy' },
  cookies: { path: '/cookies', labelKey: 'legal.cookies' },
  refunds: { path: '/refunds', labelKey: 'legal.refunds' },
  aiTransparency: { path: '/ai-transparency', labelKey: 'legal.aiTransparency' },
  dpa: { path: '/dpa', labelKey: 'legal.dpa' },
  subprocessors: { path: '/subprocessors', labelKey: 'legal.subprocessors' },
  legalNotice: { path: '/legal-notice', labelKey: 'legal.legalNotice' }
};

/** L'ordine del footer app e del sottomenu Legal — le quattro citate nel modulo di accesso vengono prima. */
export const FOOTER_LEGAL_LINKS: LegalLinkKey[] = [
  'terms',
  'privacy',
  'cookies',
  'acceptableUse',
  'refunds',
  'aiTransparency',
  'dpa',
  'subprocessors',
  'legalNotice'
];

export function legalHref(key: LegalLinkKey): string {
  return `${LEGAL_BASE_URL}${LEGAL_LINKS[key].path}`;
}
