import { FAQ } from './home';
import { plainText } from './text';
import { SITE_URL } from './links';

const SITE = `${SITE_URL}/`;

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Feega',
  url: SITE,
  email: 'hi@feega.app',
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
  description: 'An AI infinite canvas: generate images, video, audio and documents, upscale video, and publish to social media and Meta ads.',
  offers: { '@type': 'Offer', category: 'subscription' },
  publisher: { '@type': 'Organization', name: 'Feega' }
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
