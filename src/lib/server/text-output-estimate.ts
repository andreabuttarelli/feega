import type { Decide } from '$lib/canvas/decide';
import { textOutputTokens, tokenCount } from '$lib/canvas/gen-cost';

const OUTPUT_LEVELS = [
  { label: '25% of input', ratio: 0.25 },
  { label: '50% of input', ratio: 0.5 },
  { label: 'same as input', ratio: 1 },
  { label: '2x input', ratio: 2 },
  { label: '4x input', ratio: 4 }
] as const;

type EstimateInput = {
  systemPrompt: string;
  userPrompt: string;
  decide: Decide | null;
};

export async function estimateTextOutput(input: EstimateInput): Promise<number> {
  const systemTokens = tokenCount(input.systemPrompt);
  const userTokens = tokenCount(input.userPrompt);
  const inputTokens = systemTokens + userTokens;

  if (!input.decide) {
    return textOutputTokens(inputTokens);
  }

  const decision = await input.decide(
    {
      kind: 'score',
      instructions: 'Estimate the likely answer length from the prompts and token counts.',
      levels: OUTPUT_LEVELS.map((level) => level.label)
    },
    {
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      systemTokens,
      userTokens
    }
  );

  if (decision?.kind !== 'score' || typeof decision.value !== 'number') {
    return textOutputTokens(inputTokens);
  }

  const index = Math.min(OUTPUT_LEVELS.length - 1, Math.max(0, Math.round(decision.value)));
  return textOutputTokens(inputTokens, OUTPUT_LEVELS[index].ratio);
}
