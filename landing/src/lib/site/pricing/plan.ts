export type CloudPlan = {
  name: string;
  currency: string;
  monthly: number;
  annual: number;
  per: string;
};

export const PLAN: CloudPlan = {
  name: 'Cloud',
  currency: '€',
  monthly: 15,
  annual: 144,
  per: 'editor'
};

const MONTHS_PER_YEAR = 12;

export const money = (plan: CloudPlan, amount: number): string => `${plan.currency}${amount}`;

export const annualPerMonth = (plan: CloudPlan): number => plan.annual / MONTHS_PER_YEAR;

export const monthlyLine = (plan: CloudPlan): string => `${money(plan, plan.monthly)} / ${plan.per} / month`;

export const annualLine = (plan: CloudPlan): string =>
  `${money(plan, annualPerMonth(plan))} / ${plan.per} / month billed annually (${money(plan, plan.annual)} a year)`;

export const SEAT_RULE = 'Only people who edit pay. Viewers are free.';

export const EXTENSION_FOR = 'Click an element of your running app, edit it, ship the diff.';

export const EXTENSION_NOTE = 'No account, no card, no AI.';

export const EXTENSION_LINES = [
  'VS Code, Cursor, Windsurf and VSCodium',
  'React, Next.js, SvelteKit and Vue',
  'Tailwind or plain CSS',
  'Every change written to your code, with a diff',
  'Open source, Apache-2.0'
] as const;

export const CLOUD_SOON_FOR = 'For teams that design in the same codebase.';

export const cloudSoonNote = (plan: CloudPlan): string => `${monthlyLine(plan)}, or ${annualLine(plan)}. ${SEAT_RULE}`;

export const CLOUD_SOON_LINES = ['GitHub sync', 'Collaboration', 'All Pro templates and plugins'] as const;

export const freeAnswer = (plan: CloudPlan): string =>
  `Yes. The Feega extension is free, with no account and no AI. Feega ${plan.name}, with GitHub sync, collaboration and all Pro templates and plugins, is coming later at ${monthlyLine(plan)}. Viewers are free.`;
