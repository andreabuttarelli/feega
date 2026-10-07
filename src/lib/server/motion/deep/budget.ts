import { CHAT_MULTIPLIER, billedCreditsFor } from '$lib/credit-ladder';
import { creditsOfCost } from '$lib/motion/render-quote';

export type Rate = { input: number; cachedInput: number; output: number };

type Usage = { fresh: number; cached: number; output: number };

export const DEEP_ITERATIONS = { min: 2, max: 4, quoted: 3 };
export const DEEP_CAP_FACTOR = 1.5;
export const RENDER_USD = 0.06;
const MINUTES_PER_ROUND = 6;
const MINUTES_FIXED = 4;
const MILLION = 1_000_000;

const PRICIEST_RATE: Rate = { input: 15, cachedInput: 1.5, output: 75 };

const ONCE: Usage[] = [
  { fresh: 30_000, cached: 0, output: 8_000 },
  { fresh: 60_000, cached: 140_000, output: 5_000 },
  { fresh: 10_000, cached: 0, output: 1_500 }
];

const ROUND: Usage[] = [
  { fresh: 120_000, cached: 480_000, output: 25_000 },
  { fresh: 25_000, cached: 0, output: 6_000 }
];

const usdOf = (usages: Usage[], rate: Rate) => usages.reduce((sum, u) => sum + (u.fresh * rate.input + u.cached * rate.cachedInput + u.output * rate.output) / MILLION, 0);

export type DeepPrice = { usd: number; llmUsd: number; credits: number; renderCredits: number; capUsd: number; capCredits: number; minutes: number; iterations: number };

export function roundUsd(rate: Rate | null): number {
  return usdOf(ROUND, rate ?? PRICIEST_RATE) + RENDER_USD;
}

export function creditsOfUsd(usd: number): number {
  return billedCreditsFor(usd, CHAT_MULTIPLIER);
}

export function deepQuote(rate: Rate | null): DeepPrice {
  const priced = rate ?? PRICIEST_RATE;
  const iterations = DEEP_ITERATIONS.quoted;
  const llmUsd = usdOf(ONCE, priced) + iterations * usdOf(ROUND, priced);
  const renderUsd = iterations * RENDER_USD;
  const renderCredits = creditsOfCost(renderUsd);
  const usd = llmUsd + renderUsd;
  const credits = creditsOfUsd(llmUsd) + renderCredits;
  return { usd, llmUsd, credits, renderCredits, capUsd: usd * DEEP_CAP_FACTOR, capCredits: Math.ceil(credits * DEEP_CAP_FACTOR), minutes: MINUTES_FIXED + iterations * MINUTES_PER_ROUND, iterations };
}
