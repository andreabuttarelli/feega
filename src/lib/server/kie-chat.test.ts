import { describe, expect, it, vi } from 'vitest';
import { KIE_TEXT_MODELS, kieChat, kieTextUsd } from './kie-chat';

const RESPONSE = {
  id: 'resp_1',
  object: 'response',
  model: 'gpt-6.luna',
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'pronto' }] }
  ],
  usage: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 }
};

const LUNA = KIE_TEXT_MODELS[0];

function replying(status: number, body: unknown) {
  const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  return { chat: kieChat({ apiKey: 'kie-key', fetchFn: fetchFn as unknown as typeof fetch }), fetchFn };
}

describe('kie text — the Responses endpoint', () => {
  it('posts model, instructions and input with stream off, and reads the output text and tokens', async () => {
    const { chat, fetchFn } = replying(200, RESPONSE);

    const out = await chat.run(LUNA, { system: 'be brief', prompt: 'say ready' });

    expect(out).toEqual({ text: 'pronto', inputTokens: 1200, outputTokens: 300 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/codex/v1/responses');
    expect(init.headers.Authorization).toBe('Bearer kie-key');
    expect(JSON.parse(init.body)).toEqual({ model: 'gpt-6-luna', stream: false, instructions: 'be brief', input: 'say ready' });
  });

  it('throws with kie\'s reason on an HTTP error', async () => {
    const { chat } = replying(402, { code: 402, msg: 'Insufficient credits' });

    await expect(chat.run(LUNA, { prompt: 'x' })).rejects.toThrow(/kie_failed: HTTP 402 Insufficient credits/);
  });

  it('prices tokens at kie\'s listed rates: $0.03 in, $0.15 out per million for GPT 6 Luna', () => {
    expect(kieTextUsd(LUNA, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(0.18, 6);
    expect(kieTextUsd(LUNA, { inputTokens: 1200, outputTokens: 300 })).toBeCloseTo(0.0000810, 9);
  });
});
