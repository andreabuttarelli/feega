const SITE = 'https://www.feega.app/';

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'feega',
  url: SITE,
  email: 'hi@feega.app',
  founder: { '@type': 'Person', name: 'Andrea Buttarelli' },
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'support@feega.app' }]
};

const APPLICATION = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'feega',
  url: 'https://oh.feega.app',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  description: 'An AI infinite canvas: generate images, video, audio and documents, upscale video, and publish to social media and Meta ads.',
  offers: { '@type': 'Offer', category: 'subscription' },
  publisher: { '@type': 'Organization', name: 'feega' }
};

const FOUNDER = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Andrea Buttarelli',
  url: SITE,
  jobTitle: 'Founder',
  worksFor: { '@type': 'Organization', name: 'feega', url: SITE }
};

const script = (data: object) => `<script type="application/ld+json">${JSON.stringify(data)}</` + 'script>';

export const HOME_JSON_LD = [ORGANIZATION, APPLICATION, FOUNDER].map(script).join('');
