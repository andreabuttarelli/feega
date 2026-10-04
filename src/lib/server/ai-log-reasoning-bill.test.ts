import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => fakeDb({}).db }));
const { computeCostUsd } = await import('./ai-log');
const { __resetGatewayModels, ensureGatewayModels } = await import('./openrouter-models');

const SONNET = {
  data: [{ id: 'anthropic/claude-sonnet-5.5', name: 'Sonnet', supported_parameters: ['tools', 'reasoning'], pricing: { prompt: '0.000002', completion: '0.00001' } }]
};

const reasoningTurn = (model: string) => ({
  label: 'project-agent',
  provider: 'llm' as const,
  model,
  ms: 1,
  ok: true,
  inputTokens: 0,
  outputTokens: 1_000_000,
  thinkingTokens: 800_000
});

beforeEach(() => __resetGatewayModels());

describe('reasoning tokens on the gateway are billed once: completion tokens already contain them', () => {
  it('on a model priced by the gateway listing', async () => {
    const fetchImpl = (async () => ({ ok: true, status: 200, json: async () => SONNET })) as unknown as typeof fetch;
    await ensureGatewayModels({ fetchImpl, baseUrl: 'https://openrouter.ai/api/v1' });
    expect(computeCostUsd(reasoningTurn('anthropic/claude-sonnet-5.5'))).toBeCloseTo(10, 6);
  });

  it('on the gateway models priced by hand', () => {
    expect(computeCostUsd(reasoningTurn('z-ai/glm-5.3-flash'))).toBeCloseTo(0.25, 6);
    expect(computeCostUsd(reasoningTurn('openai/gpt-5.6-sol'))).toBeCloseTo(10, 6);
  });
});
