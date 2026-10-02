import { effectiveModel } from './default-models';
import { creditsForLoop, creditsForRun, textOutputTokens, tokenCount, type RunCostInput } from './gen-cost';
import { blockedReason, canStartRun } from './gen-history';
import { promptTooLong, runStateOf, type GenMedium, type GenNode, type GenParams, type ModelChoice } from './gen-node';
import { imageStepCredits } from './model3d-run';
import { model3dParamsOf } from '$lib/model3d-models';

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
};

export type RunQuote = {
  label: 'Generate' | 'Redo';
  credits: number | null;
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

  return {
    label: runStateOf(node, upstream) === 'done' ? 'Redo' : 'Generate',
    credits: input.variableTextInput ? null : creditsOf(input, cost),
    variable: Boolean(priced?.variableCredits),
    enabled: canStartRun(node, choices, upstream) && !tooLong,
    reason: tooLong && choice?.maxPromptChars ? TOO_LONG_REASON : blockedReason(node, choices, upstream),
    tooLong,
    choice,
    cost
  };
}

export function loopCreditsOf(quote: RunQuote, count: number, variableTextInput = false): number | null {
  return variableTextInput ? null : creditsForLoop(quote.cost, count);
}
