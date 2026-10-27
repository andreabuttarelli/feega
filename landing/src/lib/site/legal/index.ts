import terms from './terms.html?raw';
import privacy from './privacy.html?raw';
import cookies from './cookies.html?raw';
import acceptableUse from './acceptable-use.html?raw';
import aiTransparency from './ai-transparency.html?raw';
import legalNotice from './legal-notice.html?raw';
import dpa from './dpa.html?raw';
import subprocessors from './subprocessors.html?raw';

export type LegalDoc = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly html: string;
};

export const LEGAL_DOCS = {
  privacy: {
    label: 'Privacy',
    title: 'Privacy Policy — feega',
    description: 'How feega processes personal data under the GDPR: what we collect, why, who we share it with, how long we keep it and your rights.',
    html: privacy
  },
  terms: {
    label: 'Terms',
    title: 'Terms of Service — feega',
    description: 'The terms that govern your use of feega: accounts, credits and billing, your content, AI outputs, acceptable use and your rights.',
    html: terms
  },
  cookies: {
    label: 'Cookies',
    title: 'Cookie Policy — feega',
    description: 'The cookies, browser storage and trackers feega uses, why, for how long, and how consent works.',
    html: cookies
  },
  'acceptable-use': {
    label: 'Acceptable use',
    title: 'Acceptable Use Policy — feega',
    description: 'What you may not create, share or publish with feega, how we enforce it and how to report abuse.',
    html: acceptableUse
  },
  'ai-transparency': {
    label: 'AI transparency',
    title: 'AI Transparency — feega',
    description: 'Which AI features feega has, which models power them, how outputs are marked and how requests are moderated.',
    html: aiTransparency
  },
  dpa: {
    label: 'DPA',
    title: 'Data Processing Agreement — feega',
    description: 'The GDPR Art. 28 data processing agreement between feega and its business customers.',
    html: dpa
  },
  subprocessors: {
    label: 'Sub-processors',
    title: 'Sub-processors — feega',
    description: 'The providers feega uses to run the service, what data they process, where, and under which transfer mechanism.',
    html: subprocessors
  },
  'legal-notice': {
    label: 'Legal notice',
    title: 'Legal Notice — feega',
    description: 'Who operates feega: company details, contacts and legal documents.',
    html: legalNotice
  }
} as const satisfies Record<string, LegalDoc>;

export type LegalSlug = keyof typeof LEGAL_DOCS;

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.hasOwn(LEGAL_DOCS, slug);
}
