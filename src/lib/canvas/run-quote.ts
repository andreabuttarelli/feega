import { effectiveModel } from './default-models';
import { creditsForLoop, creditsForRun, textOutputTokens, tokenCount, type RunCostInput } from './gen-cost';
import { blockedReason, canStartRun } from './gen-history';
import { promptTooLong, runStateOf, type GenNode, type ModelChoice } from './gen-node';

export const TOO_LONG_REASON = 'Prompt troppo lungo';

export type RunQuoteInput = {
  node: GenNode;
  choices: ModelChoice[];
  hasUpstreamText?: boolean;
  variableTextInput?: boolean;
  enhanceUnitCredits?: number;
  estimatedTextInputTokens?: number;
  estimatedTextOutputTokens?: number;
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
    params: node.params,
    prompt: node.prompt,
    textInputTokens: input.estimatedTextInputTokens,
    enhanceUnitCredits: input.enhanceUnitCredits
  };

  return {
    label: runStateOf(node, upstream) === 'done' ? 'Redo' : 'Generate',
    credits: input.variableTextInput ? null : creditsForRun(cost),
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
