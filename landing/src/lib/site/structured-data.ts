import { PLAN } from './pricing/plan';
import { FAQ } from './home';
import { plainText } from './text';
import type { Topic } from './topics/topic';
import { DISCORD_URL, DOWNLOAD_PATH, FEEGA_VERSION, GITHUB_URL, SITE_URL, SOCIAL_LINKS } from './links';

const SITE = `${SITE_URL}/`;

const SAME_AS = [...new Set([GITHUB_URL, DISCORD_URL, ...SOCIAL_LINKS.map((l) => l.href)])];

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Feega',
  url: SITE,
  logo: `${SITE}site/logo.png`,
  email: 'hi@feega.app',
  sameAs: SAME_AS,
  founder: { '@type': 'Person', name: 'Andrea Buttarelli' },
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'support@feega.app' }]
};

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Feega',
  alternateName: ['feega.app', 'Feega editor'],
  url: SITE,
  publisher: { '@type': 'Organization', name: 'Feega', url: SITE }
};

const APPLICATION = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Feega',
  url: SITE,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS, Linux',
  description: 'Feega is a free, open-source editor for your running app: click any element, edit it like in Figma, and the change is written to your code. Runs in VS Code, Cursor and Windsurf, or from any terminal with npx feega. No AI inside, no credits, with diffs.',
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR', description: 'Free and open source.' },
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

export const script = (data: object) => `<script type="application/ld+json">${JSON.stringify(data)}</` + 'script>';

export const faqJsonLd = (items: readonly { q: string; a: string }[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plainText(a) } }))
  });

export type Crumb = { name: string; path: string };

export const breadcrumbJsonLd = (trail: readonly Crumb[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Feega', path: '/' }, ...trail].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.path.slice(1)}` }))
  });

export const HOME_JSON_LD = [WEBSITE, ORGANIZATION, APPLICATION, FOUNDER].map(script).join('') + faqJsonLd(FAQ);

export const altLandingJsonLd = (page: { name: string; description: string; path: string; faq: readonly { q: string; a: string }[] }) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.name,
    description: page.description,
    url: `${SITE}${page.path.slice(1)}`,
    isPartOf: { '@type': 'WebSite', name: 'Feega', url: SITE },
    about: { '@type': 'SoftwareApplication', name: 'Feega', url: SITE }
  }) +
  script(APPLICATION) +
  faqJsonLd(page.faq);

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

export const topicJsonLd = (topic: Topic, path: string) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: topic.title,
    description: topic.description,
    url: `${SITE}${path.slice(1)}`,
    mainEntityOfPage: `${SITE}${path.slice(1)}`,
    image: `${SITE_URL}${topic.cover.src}`,
    datePublished: topic.checked,
    dateModified: topic.checked,
    author: { '@type': 'Person', name: 'Andrea Buttarelli' },
    publisher: { '@type': 'Organization', name: 'Feega', url: SITE }
  }) +
  script(ORGANIZATION) +
  faqJsonLd(topic.questions);

export const howToJsonLd = (name: string, steps: readonly { name: string; text: string }[]) =>
  script({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text }))
  });

export const downloadJsonLd = () =>
  script({
    ...APPLICATION,
    '@context': 'https://schema.org',
    softwareVersion: FEEGA_VERSION,
    downloadUrl: `${SITE_URL}${DOWNLOAD_PATH}`,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' }
  });
