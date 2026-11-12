export type CloudPlan = {
  name: string;
  currency: string;
  price: number;
  period: string;
  includedUnits: number;
  topUpFrom: number;
};

export type Outcome = { label: string; usd: number };

export const UNITS_PER_CREDIT = 100;

export const UNITS_PER_USD = 100;

export const AI_MARKUP = 0.2;

export const FREE_UNITS = 100;

export const PLAN_LOW: CloudPlan = { name: 'Cloud', currency: '$', price: 9, period: 'month', includedUnits: 500, topUpFrom: 10 };

export const PLAN_STANDARD: CloudPlan = { name: 'Cloud', currency: '$', price: 18, period: 'month', includedUnits: 1800, topUpFrom: 10 };

export const IMAGE: Outcome = { label: 'Images', usd: 0.0748 };

export const CLIP: Outcome = { label: 'HD video clips', usd: 0.38 };

export const unitsFor = (outcome: Outcome, count: number): number => count * outcome.usd * (1 + AI_MARKUP) * UNITS_PER_USD;

export const outcomesIn = (units: number, outcome: Outcome): number => Math.floor(units / unitsFor(outcome, 1));

export const credits = (units: number): number => Math.ceil(units / UNITS_PER_CREDIT);

export const money = (plan: CloudPlan, amount: number): string => `${plan.currency}${amount}`;

export const includedCredits = (plan: CloudPlan): number => plan.includedUnits / UNITS_PER_CREDIT;

export const estimate = (plan: CloudPlan, images: number, clips: number) => {
  const units = unitsFor(IMAGE, images) + unitsFor(CLIP, clips);
  return { credits: credits(units), topUp: credits(Math.max(0, units - plan.includedUnits)) };
};

export const CLOUD_FOR = 'For teams, and anyone who wants AI without managing keys.';

export const CLOUD_BENEFITS = [
  'Every AI model in one place, no keys to manage',
  'The AI assistant inside the editor',
  'Real-time collaboration with your whole team',
  'Your agents connect through our hosted MCP',
  'Import your brand, products and social posts'
] as const;

export const CREDIT_RULES = 'Credits are spent only by AI. Designing, editing and exporting are free.';

export const outOfCredits = (plan: CloudPlan): string =>
  `Run out? AI pauses until you top up or the ${plan.period} renews. Top-ups start at ${money(plan, plan.topUpFrom)} and never expire.`;

export const getsYou = (plan: CloudPlan): string =>
  `${includedCredits(plan)} credits a ${plan.period}: about ${outcomesIn(plan.includedUnits, IMAGE)} images or ${outcomesIn(plan.includedUnits, CLIP)} short HD video clips.`;

export const trialLine = (): string =>
  `New accounts get ${credits(FREE_UNITS)} free credit, about ${outcomesIn(FREE_UNITS, IMAGE)} images. No card needed.`;

export const pricingFaq = (plan: CloudPlan) => [
  {
    q: 'Can I use feega for free?',
    a: `Yes. Run npx feega and the full editor is yours on your machine, free forever, with your own AI keys. In the cloud, new accounts get ${credits(FREE_UNITS)} free credit to try AI.`
  },
  {
    q: 'What is a credit?',
    a: `What AI costs in the cloud. Each run is charged at the model's own price plus ${AI_MARKUP * 100}%. The plan includes ${includedCredits(plan)} credits, refreshed every ${plan.period}.`
  },
  {
    q: 'What happens when I run out?',
    a: `AI actions pause until you top up or your plan renews. Designing, editing and exporting keep working. Top-ups start at ${money(plan, plan.topUpFrom)} and never expire.`
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, any time, from the Credits page of your workspace. Unused top-ups stay yours.'
  }
];
