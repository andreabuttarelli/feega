export type TopUp = { price: number; credits: number };

export type CloudPlan = {
  name: string;
  currency: string;
  price: number;
  per: string;
  period: string;
  includedCredits: number;
  topUps: readonly TopUp[];
  freeAgentLayersPerWeek: number;
};

export type Outcome = { label: string; usd: number };

export const CREDITS_PER_PROVIDER_USD = 120;

export const FREE_CREDITS = 100;

export const FREE_EDITORS = 1;

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
  ],
  freeAgentLayersPerWeek: 1000
};

export const AGENTS = ['Claude Code', 'Claude', 'Codex', 'Cursor'] as const;

export const AGENT_DOCS_URL = 'https://docs.feega.app/integrations/mcp/';

const agentList = (): string => `${AGENTS.slice(0, -1).join(', ')} or ${AGENTS[AGENTS.length - 1]}`;

export const IMAGE: Outcome = { label: 'Images', usd: 0.0748 };

export const CLIP: Outcome = { label: 'HD video clips', usd: 0.38 };

export const creditsFor = (outcome: Outcome, count: number): number => count * outcome.usd * CREDITS_PER_PROVIDER_USD;

export const outcomesIn = (credits: number, outcome: Outcome): number => Math.floor(credits / creditsFor(outcome, 1));

export const count = (credits: number): string => Math.ceil(credits).toLocaleString('en');

export const money = (plan: CloudPlan, amount: number): string => `${plan.currency}${amount}`;

export const priceUnit = (plan: CloudPlan): string => `/ ${plan.per} / ${plan.period}`;

export const SEAT_RULE = 'Only people who edit pay. Viewers and your AI agents are free.';

export const topUpPrices = (plan: CloudPlan): string => {
  const prices = plan.topUps.map((t) => money(plan, t.price));
  return `${prices.slice(0, -1).join(', ')} or ${prices[prices.length - 1]}`;
};

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

export const freeStart = (plan: CloudPlan): string => `Start free: ${FREE_EDITORS} ${plan.per}, ${count(FREE_CREDITS)} credits, no card.`;

export const creditsLine = (plan: CloudPlan): string => `${count(plan.includedCredits)} AI credits per ${plan.per} a ${plan.period}, carried over.`;

export const getsYou = (plan: CloudPlan): string =>
  `${count(plan.includedCredits)} credits per ${plan.per} each ${plan.period}, shared by the team: about ${outcomesIn(plan.includedCredits, IMAGE)} images or ${outcomesIn(plan.includedCredits, CLIP)} short HD video clips per ${plan.per}. Unused credits carry over.`;

export const freeTier = (): string =>
  `Start free: ${FREE_EDITORS} ${PLAN.per}, unlimited viewers and ${count(FREE_CREDITS)} credits to try AI, about ${outcomesIn(FREE_CREDITS, IMAGE)} images. No card needed.`;

export const bringYourAgent = (plan: CloudPlan): string =>
  `Bring the agent you already pay for: ${agentList()} edits your canvas through our MCP server or CLI, up to ${count(plan.freeAgentLayersPerWeek)} agent-made layers in any 7 days for free.`;

export const agentAnswer = (plan: CloudPlan): string =>
  `Yes. ${agentList()} work on your canvas through our MCP server or CLI, on the subscription you already have. Free teams get ${count(plan.freeAgentLayersPerWeek)} agent-made layers in any 7 days; the paid plan has no limit.`;

export const moreSeats = (plan: CloudPlan): string =>
  `More ${plan.per}s need the plan, and only the team owner can add one. Each is charged ${money(plan, plan.price)} a ${plan.period} from the day they accept, prorated to your renewal.`;

export const seatAnswer = (plan: CloudPlan): string =>
  `Anyone who edits; viewers and AI agents are free. Extra ${plan.per}s are ${money(plan, plan.price)} a ${plan.period} each, prorated to your renewal, and only the team owner can add them.`;

export const creditsAnswer = (plan: CloudPlan): string =>
  `Only AI spends credits, at ${CREDITS_PER_PROVIDER_USD} credits for every $1 the AI provider charges (100 credits = ${money(plan, 1)}). Designing, editing and exporting are free, and each ${plan.per} adds ${count(plan.includedCredits)} credits a ${plan.period} to the team's pool, carried over.`;

export const runOutAnswer = (plan: CloudPlan): string =>
  `AI pauses until next ${plan.period}'s credits arrive or you top up with ${topUpPrices(plan)}; everything else keeps working. Credits never expire.`;

export const freeAnswer = (plan: CloudPlan): string =>
  `Yes. The Feega extension is free, with no account and no AI. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming later.`;
