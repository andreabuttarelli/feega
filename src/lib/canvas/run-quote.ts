import { effectiveModel } from './default-models';
import { creditsForLoop, creditsForRun, textOutputTokens, tokenCount, type RunCostInput } from './gen-cost';
import { blockedReason, canStartRun } from './gen-history';
import { promptTooLong, runStateOf, type GenMedium, type GenNode, type GenParams, type ModelChoice } from './gen-node';
import { AUTO_ROUTE, PROVIDER_PARAM } from './model-routes';
import { imageStepCredits } from './model3d-run';
import { model3dParamsOf } from '$lib/model3d-models';
import { effectiveVariants, variantCountsFor, variantsCredits, variantsIntoOf, type RememberedVariants, type VariantInto } from './variants';

export const TOO_LONG_REASON = 'Prompt troppo lungo';

export type RunQuoteInput = {
  node: GenNode;
  choices: ModelChoice[];
  hasUpstreamText?: boolean;
  variableTextInput?: boolean;
  enhanceUnitCredits?: number;
  estimatedTextInputTokens?: number;
  estimatedTextOutputTokens?: number;
  hasUpstreamImage?: boolean;
  imageChoices?: ModelChoice[];
  remembered?: RememberedVariants | null;
};

export type VariantsQuote = { count: number; into: VariantInto; counts: number[] };

export type RunQuote = {
  label: 'Generate' | 'Redo';
  credits: number | null;
  variants: VariantsQuote | null;
  variable: boolean;
  enabled: boolean;
  reason: string | null;
  tooLong: boolean;
  choice: ModelChoice | undefined;
  cost: RunCostInput;
};

function pricedChoiceOf(input: RunQuoteInput, choice: ModelChoice | undefined): ModelChoice | undefined {
  if (input.node.medium !== 'text' || !choice?.textPricing) {
    return choice;
  }

  return {
    ...choice,
    variableCredits: choice.variableCredits || input.variableTextInput,
    textPricing: {
      ...choice.textPricing,
      estimatedOutputTokens:
        input.estimatedTextOutputTokens ?? textOutputTokens(choice.textPricing.systemPromptTokens + tokenCount(input.node.prompt))
    }
  };
}

const PRICED_PARAMS: Readonly<Partial<Record<GenMedium, (model: string, params: GenParams) => GenParams>>> = {
  model3d: (model, params) => {
    const settings = model3dParamsOf(model, params as Record<string, unknown>);
    return settings.ok ? ({ ...params, ...settings.params } as GenParams) : params;
  }
};

const STEP_CREDITS: Readonly<Partial<Record<GenMedium, (input: RunQuoteInput) => number>>> = {
  model3d: (input) =>
    imageStepCredits({
      prompt: input.node.prompt,
      hasUpstreamText: input.hasUpstreamText ?? false,
      hasUpstreamImage: input.hasUpstreamImage ?? false,
      imageChoices: input.imageChoices ?? []
    })
};

function pricedParamsOf(node: GenNode, choice: ModelChoice | undefined): GenParams {
  const priced = PRICED_PARAMS[node.medium];
  return priced && choice ? priced(choice.id, node.params) : node.params;
}

function creditsOf(input: RunQuoteInput, cost: RunCostInput): number | null {
  const credits = creditsForRun(cost);
  return credits === null ? null : credits + (STEP_CREDITS[input.node.medium]?.(input) ?? 0);
}

export function runQuoteOf(input: RunQuoteInput): RunQuote {
  const { node, choices } = input;
  const upstream = { hasUpstreamText: input.hasUpstreamText ?? false };
  const resolved = effectiveModel(node.medium, node.model, choices);
  const choice = choices.find((c) => c.id === resolved) ?? choices[0];
  const priced = pricedChoiceOf(input, choice);
  const tooLong = !!choice && promptTooLong(node.prompt, choice);
  const cost: RunCostInput = {
    medium: node.medium,
    model: priced ?? null,
    params: pricedParamsOf(node, choice),
    prompt: node.prompt,
    textInputTokens: input.estimatedTextInputTokens,
    enhanceUnitCredits: input.enhanceUnitCredits
  };

  const counts = variantCountsFor(node.medium, choice);
  const remembered = input.remembered ?? null;
  const count = effectiveVariants(node.medium, node.params, remembered, choice);
  const variants = counts.length > 1 ? { count, into: variantsIntoOf(node.params, remembered), counts } : null;

  return {
    label: runStateOf(node, upstream) === 'done' ? 'Redo' : 'Generate',
    credits: input.variableTextInput ? null : variantsCredits(creditsOf(input, cost), count),
    variants,
    variable: Boolean(priced?.variableCredits),
    enabled: canStartRun(node, choices, upstream) && !tooLong,
    reason: tooLong && choice?.maxPromptChars ? TOO_LONG_REASON : blockedReason(node, choices, upstream),
    tooLong,
    choice,
    cost
  };
}

export function runLabelOf(quote: Pick<RunQuote, 'label' | 'variants'>): string {
  return quote.variants && quote.variants.count > 1 ? `${quote.label} ×${quote.variants.count}` : quote.label;
}

export function loopCreditsOf(quote: RunQuote, count: number, variableTextInput = false): number | null {
  return variableTextInput ? null : creditsForLoop(quote.cost, count);
}

export type ProviderQuote = { provider: string; label: string; credits: number | null; cheapest: boolean; selected: boolean };

export function providerQuotesOf(input: RunQuoteInput): ProviderQuote[] {
  const routes = runQuoteOf(input).choice?.routes ?? [];
  const chosen = input.node.params.provider ?? AUTO_ROUTE;
  const quotes = routes.map((route) => ({
    provider: route.provider,
    label: route.label,
    credits: runQuoteOf({ ...input, node: { ...input.node, params: { ...input.node.params, [PROVIDER_PARAM]: route.provider } } }).credits,
    cheapest: false,
    selected: route.provider === chosen
  }));
  const direct = quotes.filter((quote) => quote.provider !== AUTO_ROUTE);
  if (direct.length < 2) {
    return [];
  }
  const prices = direct.flatMap((quote) => (quote.credits === null ? [] : [quote.credits]));
  return quotes.map((quote) => ({ ...quote, cheapest: quote.provider !== AUTO_ROUTE && quote.credits !== null && quote.credits === Math.min(...prices) }));
}
