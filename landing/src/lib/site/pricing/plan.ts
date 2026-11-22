export type CloudPlan = {
  name: string;
  currency: string;
  price: number;
  annualMonthly: number;
  annualTotal: number;
  per: string;
};

export const PLAN: CloudPlan = {
  name: 'Cloud',
  currency: '€',
  price: 15,
  annualMonthly: 12,
  annualTotal: 144,
  per: 'editor'
};

export const priceLabel = (plan: CloudPlan): string => `${plan.currency}${plan.price}`;

export const priceUnit = (plan: CloudPlan): string => `/ ${plan.per} / month`;

export const annualLine = (plan: CloudPlan): string =>
  `or ${plan.currency}${plan.annualMonthly} a month billed annually, ${plan.currency}${plan.annualTotal} a year. Viewers are free.`;

export const EXTENSION_FOR = 'Click an element of your running app, edit it, ship the diff.';

export const EXTENSION_NOTE = 'No account, no card, no AI.';

export const EXTENSION_LINES = [
  'VS Code, Cursor, Windsurf and VSCodium',
  'React, Next.js, SvelteKit, Vue, Nuxt, React Router, Astro and Vite',
  'Tailwind or plain CSS',
  'Every change written to your code, with a diff',
  'Open source, Apache-2.0'
] as const;

export const CLOUD_SOON_FOR = 'For teams that design in the same codebase.';

export const CLOUD_SOON_NOTE = 'Star the repo to hear first.';

export const CLOUD_SOON_LINES = ['GitHub sync', 'Collaboration', 'Sections and templates', 'All Pro templates'] as const;

export const freeAnswer = (): string =>
  'Yes. The Feega extension is free, with no account and no AI. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.';
