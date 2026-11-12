export type TopUp = { price: number; credits: number };

export type CloudPlan = {
  name: string;
  currency: string;
  price: number;
  per: string;
  period: string;
  includedCredits: number;
  topUps: readonly TopUp[];
};

export type Outcome = { label: string; usd: number };

export const CREDITS_PER_PROVIDER_USD = 120;

export const FREE_CREDITS = 100;

export const PLAN: CloudPlan = {
  name: 'Cloud',
  currency: '€',
  price: 9,
  per: 'editor',
  period: 'month',
  includedCredits: 500,
  topUps: [
    { price: 10, credits: 1000 },
    { price: 20, credits: 2000 },
    { price: 50, credits: 5000 }
  ]
};

export const IMAGE: Outcome = { label: 'Images', usd: 0.0748 };

export const CLIP: Outcome = { label: 'HD video clips', usd: 0.38 };

export const creditsFor = (outcome: Outcome, count: number): number => count * outcome.usd * CREDITS_PER_PROVIDER_USD;

export const outcomesIn = (credits: number, outcome: Outcome): number => Math.floor(credits / creditsFor(outcome, 1));

export const count = (credits: number): string => Math.ceil(credits).toLocaleString('en');

export const money = (plan: CloudPlan, amount: number): string => `${plan.currency}${amount}`;

export const topUpsFor = (plan: CloudPlan, gap: number): TopUp[] => {
  const largest = plan.topUps[plan.topUps.length - 1];
  const full = Math.floor(gap / largest.credits);
  const rest = gap - full * largest.credits;
  const parts: TopUp[] = Array(full).fill(largest);
  if (rest === 0) {
    return parts;
  }

  return [...parts, plan.topUps.find((t) => t.credits >= rest) ?? largest];
};

export const MAX_SEATS = 20;

export const estimate = (plan: CloudPlan, seats: number, images: number, clips: number) => {
  const included = seats * plan.includedCredits;
  const credits = Math.ceil(creditsFor(IMAGE, images) + creditsFor(CLIP, clips));
  const gap = Math.max(0, credits - included);
  return { cost: seats * plan.price, included, credits, gap, topUps: topUpsFor(plan, gap) };
};

export const priceUnit = (plan: CloudPlan): string => `/ ${plan.per} / ${plan.period}`;

export const seats = (plan: CloudPlan, n: number): string => `${n} ${plan.per}${n === 1 ? '' : 's'}`;

export const SEAT_RULE = 'Only people who edit pay. Viewers and your AI agents are free.';

export const topUpPrices = (plan: CloudPlan): string => {
  const prices = plan.topUps.map((t) => money(plan, t.price));
  return `${prices.slice(0, -1).join(', ')} or ${prices[prices.length - 1]}`;
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
  `Run out? AI pauses until next ${plan.period}'s credits arrive, or top up ${topUpPrices(plan)}. Credits never expire.`;

export const getsYou = (plan: CloudPlan): string =>
  `${count(plan.includedCredits)} credits per ${plan.per} each ${plan.period}, shared by the team: about ${outcomesIn(plan.includedCredits, IMAGE)} images or ${outcomesIn(plan.includedCredits, CLIP)} short HD video clips per ${plan.per}. Unused credits carry over.`;

export const freeTier = (): string =>
  `Start free: one ${PLAN.per}, unlimited viewers and ${count(FREE_CREDITS)} credits to try AI, about ${outcomesIn(FREE_CREDITS, IMAGE)} images. No card needed.`;

export const moreSeats = (plan: CloudPlan): string =>
  `Inviting more ${plan.per}s needs the plan: each adds ${money(plan, plan.price)} a ${plan.period} from the day they accept.`;

export const seatCost = (plan: CloudPlan, n: number, cost: number, included: number): string =>
  `${seats(plan, n)} ${n === 1 ? 'costs' : 'cost'} ${money(plan, cost)} and ${n === 1 ? 'includes' : 'include'} ${count(included)}.`;

export const creditsAnswer = (plan: CloudPlan): string =>
  `In the cloud, AI runs are paid in credits: 100 credits = ${money(plan, 1)}. A run costs ${CREDITS_PER_PROVIDER_USD} credits for every $1 the AI provider charges. The plan is ${money(plan, plan.price)} per ${plan.per} per ${plan.period}, and each ${plan.per} adds ${count(plan.includedCredits)} credits a ${plan.period} to a pool the team shares. Unused credits carry over. Viewers and AI agents are free. Top-ups of ${topUpPrices(plan)} never expire. Running locally with your own keys needs no credits.`;

export const pricingFaq = (plan: CloudPlan) => [
  {
    q: 'Can I use feega for free?',
    a: `Yes. Run npx feega and the full editor is yours on your machine, free, with your own AI keys. In the cloud, one ${plan.per} is free, with unlimited viewers and ${count(FREE_CREDITS)} credits to try AI.`
  },
  {
    q: `Who counts as an ${plan.per}?`,
    a: `Anyone in your workspace who edits. The free tier is one ${plan.per} with unlimited viewers. Inviting more ${plan.per}s needs the paid plan: each one adds ${money(plan, plan.price)} a ${plan.period} from the day they accept, and ${count(plan.includedCredits)} credits to the team's pool. Viewers, and AI agents working through MCP or the CLI, are always free.`
  },
  {
    q: 'What is a credit?',
    a: `What AI costs in the cloud. 100 credits = ${money(plan, 1)}, and a run costs ${CREDITS_PER_PROVIDER_USD} credits for every $1 the AI provider charges. Designing, editing and exporting cost nothing.`
  },
  {
    q: 'What happens when I run out?',
    a: `AI actions pause until next ${plan.period}'s credits arrive or you top up (${topUpPrices(plan)}). Everything else keeps working, and no credits expire.`
  },
  {
    q: 'Can I cancel?',
    a: "Yes. Manage or cancel your subscription from the billing portal on your workspace's Credits page. Credits you bought stay yours."
  }
];
