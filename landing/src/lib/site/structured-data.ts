import { PLAN } from './pricing/plan';
import { FAQ } from './home';
import { plainText } from './text';
import { DISCORD_URL, GITHUB_URL, SITE_URL, SOCIAL_LINKS } from './links';

const SITE = `${SITE_URL}/`;

const SAME_AS = [...new Set([GITHUB_URL, DISCORD_URL, ...SOCIAL_LINKS.map((l) => l.href)])];

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Feega',
  url: SITE,
  email: 'hi@feega.app',
  sameAs: SAME_AS,
  founder: { '@type': 'Person', name: 'Andrea Buttarelli' },
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'support@feega.app' }]
};

const APPLICATION = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Feega',
  url: 'https://oh.feega.app',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  description: 'Design inside your code with your agents and team: an open-source canvas for website designs and motion videos, driven by prompts, Claude Code, Codex or Cursor.',
  offers: {
    '@type': 'Offer',
    category: 'subscription',
    price: PLAN.price,
    priceCurrency: 'EUR',
    description: `Per ${PLAN.per} per ${PLAN.period}. Viewers and AI agents are free.`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: PLAN.price, priceCurrency: 'EUR', unitText: `${PLAN.per} / ${PLAN.period}` }
  },
  sameAs: SAME_AS,
  publisher: { '@type': 'Organization', name: 'Feega', sameAs: SAME_AS }
};

const FOUNDER = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Andrea Buttarelli',
  url: SITE,
  jobTitle: 'Founder',
  worksFor: { '@type': 'Organization', name: 'Feega', url: SITE }
};

const script = (data: object) => `<script type="application/ld+json">${JSON.stringify(data)}</` + 'script>';

export const faqJsonLd = (items: readonly { q: string; a: string }[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plainText(a) } }))
  });

export const breadcrumbJsonLd = (name: string, path: string) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Feega', item: SITE },
      { '@type': 'ListItem', position: 2, name, item: `${SITE}${path.slice(1)}` }
    ]
  });

export const HOME_JSON_LD = [ORGANIZATION, APPLICATION, FOUNDER].map(script).join('') + faqJsonLd(FAQ);

export const articleJsonLd = (article: { title: string; description: string; path: string; checked: string }) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: `${SITE}${article.path.slice(1)}`,
    dateModified: article.checked,
    author: { '@type': 'Person', name: 'Andrea Buttarelli' },
    publisher: { '@type': 'Organization', name: 'Feega', url: SITE }
  });

export const howToJsonLd = (name: string, steps: readonly { name: string; text: string }[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text }))
  });
