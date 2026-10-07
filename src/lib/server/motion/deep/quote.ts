import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { DEEP_QUOTE, type DeepQuote } from '$lib/motion/deep';
import { ensureGatewayModels, gatewayRate } from '$lib/server/openrouter-models';
import { deepQuote } from './budget';

const TEXT_ID = 'deep-quote';

export async function quoteFor(input: { message: string; model: string; reasoning: string | null }): Promise<DeepQuote> {
  await ensureGatewayModels();
  const price = deepQuote(gatewayRate(input.model));
  return { ...input, credits: price.credits, capCredits: price.capCredits, minutes: price.minutes, iterations: price.iterations };
}

export function quoteResponse(quote: DeepQuote): Response {
  const text = `This is a Deep job: I storyboard it, build it, render it and review the frames ${quote.iterations} times or until it is right. About ${quote.minutes} minutes and ${quote.credits} credits (never more than ${quote.capCredits}). Confirm to start: you can close the tab, it keeps going.`;
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: DEEP_QUOTE, data: quote });
      writer.write({ type: 'text-start', id: TEXT_ID });
      writer.write({ type: 'text-delta', id: TEXT_ID, delta: text });
      writer.write({ type: 'text-end', id: TEXT_ID });
      writer.write({ type: 'finish' });
    }
  });
  return createUIMessageStreamResponse({ stream });
}
