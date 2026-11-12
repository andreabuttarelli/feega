export enum Tone {
  Primary = 'primary',
  Quiet = 'quiet'
}

export type CloudPlan = {
  name: string;
  price: number;
  period: string;
  credits: number;
  topUpFrom: number;
};

export type Outcome = { id: string; label: string; usd: number };

export const CURRENCY = '$';

export const AI_MARKUP = 0.2;

export const FREE_CREDITS = 1;

export const PLAN_STANDARD: CloudPlan = { name: 'Cloud', price: 18, period: 'month', credits: 18, topUpFrom: 8 };

export const PLAN_LOW: CloudPlan = { name: 'Cloud', price: 9, period: 'month', credits: 9, topUpFrom: 8 };

export const IMAGE: Outcome = { id: 'image', label: 'images', usd: 0.0748 };

export const CLIP: Outcome = { id: 'clip', label: 'HD video clips', usd: 0.38 };

export const creditsFor = (outcome: Outcome, count: number): number => count * outcome.usd * (1 + AI_MARKUP);

export const outcomesIn = (credits: number, outcome: Outcome): number => Math.floor(credits / creditsFor(outcome, 1));

export const money = (amount: number): string => `${CURRENCY}${amount}`;

export const LOCAL_FOR = 'For working on your own machine, with your own AI keys.';

export const CLOUD_FOR = 'For teams, and anyone who wants AI without managing keys.';

export const LOCAL_BENEFITS = [
  'The full editor: design, motion and code export',
  'Your work saved in one .feega file',
  'Generate with your own AI keys',
  'Agents edit your canvas through the CLI and MCP',
  'No account, no credits'
] as const;

export const CLOUD_BENEFITS = [
  'Every AI model in one place, no keys to manage',
  'The AI assistant inside the editor',
  'Real-time collaboration with your whole team',
  'Your agents connect through our hosted MCP',
  'Import your brand, products and social posts'
] as const;

export const COMPARE_ROWS = [
  { feature: 'Design, motion and code export', local: true, cloud: true },
  { feature: 'Paste from Figma', local: true, cloud: true },
  { feature: 'Agents through the CLI and MCP', local: true, cloud: true },
  { feature: 'AI generation with your own keys', local: true, cloud: false },
  { feature: 'Every AI model, no keys needed', local: false, cloud: true },
  { feature: 'AI assistant in the editor', local: false, cloud: true },
  { feature: 'Real-time team collaboration', local: false, cloud: true },
  { feature: 'Brand, products and social imports', local: false, cloud: true }
] as const;

export const OUT_OF_CREDITS = 'Run out? AI pauses until you top up or the month renews. Designing and exporting never stop.';

export const topUpLine = (plan: CloudPlan): string =>
  `Need more? Top up from ${money(plan.topUpFrom)} any time, no plan change. Top-ups never expire.`;

export const getsYou = (plan: CloudPlan): string =>
  `${plan.credits} credits a month is about ${outcomesIn(plan.credits, IMAGE)} images or ${outcomesIn(plan.credits, CLIP)} short HD video clips.`;

export const trialLine = (): string =>
  `New accounts get ${FREE_CREDITS} free credit, about ${outcomesIn(FREE_CREDITS, IMAGE)} images. No card needed.`;

export const estimate = (plan: CloudPlan, images: number, clips: number) => {
  const credits = creditsFor(IMAGE, images) + creditsFor(CLIP, clips);
  return { credits: Math.ceil(credits), extra: Math.max(0, Math.ceil(credits - plan.credits)) };
};

export const creditSteps =(plan: CloudPlan) => [
  { title: `${plan.credits} credits every ${plan.period}`, body: `Included in your ${money(plan.price)}, refreshed each ${plan.period}.` },
  { title: 'Spent only by AI', body: `Images, video, voice and the assistant cost the model's price plus ${AI_MARKUP * 100}%. Editing is free.` },
  { title: 'Top up when you run out', body: `From ${money(plan.topUpFrom)}, any time. Top-ups never expire.` }
];

export const pricingFaq =(plan: CloudPlan) => [
  {
    q: 'Can I use feega for free?',
    a: `Yes. Run npx feega and the full editor is yours on your machine, free forever, with your own AI keys. In the cloud, new accounts get ${FREE_CREDITS} free credit to try AI.`
  },
  {
    q: 'What is a credit?',
    a: `What AI costs in the cloud. Each run is charged at the model's own price plus ${AI_MARKUP * 100}%. Your ${money(plan.price)} a ${plan.period} becomes ${plan.credits} credits, refreshed every ${plan.period}.`
  },
  {
    q: 'What happens when I run out?',
    a: `AI actions pause until you top up or your plan renews. Designing, editing and exporting keep working. Top-ups start at ${money(plan.topUpFrom)} and never expire.`
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, any time, from the Credits page of your workspace. Unused top-ups stay yours.'
  }
];
