import type { Decide } from '$lib/canvas/decide';
import { tokenCount } from '$lib/canvas/gen-cost';
import { textRequest } from '$lib/canvas/text-request';
import { estimateTextOutput } from '$lib/server/text-output-estimate';

type TextCostEstimateInput = {
  material: string[];
  ownPrompt: string;
  inputCost: 'fixed' | 'variable_media';
  decide: Decide | null;
};

export async function estimateCanvasTextCost(input: TextCostEstimateInput) {
  const request = textRequest(input.material, input.ownPrompt);
  const estimatedOutputTokens = await estimateTextOutput({
    systemPrompt: request.system,
    userPrompt: request.user,
    decide: input.decide
  });

  return {
    estimatedOutputTokens,
    systemPromptTokens: tokenCount(request.system),
    userPromptTokens: tokenCount(request.user),
    variableInput: input.inputCost === 'variable_media'
  };
}
