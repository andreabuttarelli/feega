import terms from './terms.html?raw';
import privacy from './privacy.html?raw';
import cookies from './cookies.html?raw';

export type LegalDoc = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly html: string;
};

export const LEGAL_DOCS = {
  privacy: {
    label: 'Privacy',
    title: 'Privacy Policy — Feega',
    description: 'How Feega processes personal data under the GDPR: what we collect, why, who we share it with, how long we keep it and your rights.',
    html: privacy
  },
  terms: {
    label: 'Terms',
    title: 'Terms of Service — Feega',
    description: 'The terms that govern your use of Feega: accounts, credits and billing, your content, AI outputs, acceptable use and your rights.',
    html: terms
  },
  cookies: {
    label: 'Cookies',
    title: 'Cookie Policy — Feega',
    description: 'The cookies, browser storage and trackers Feega uses, why, for how long, and how consent works.',
    html: cookies
  }
} as const satisfies Record<string, LegalDoc>;

export type LegalSlug = keyof typeof LEGAL_DOCS;

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.hasOwn(LEGAL_DOCS, slug);
}
