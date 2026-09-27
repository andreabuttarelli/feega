import { beforeEach, describe, expect, it } from 'vitest';
import { __resetGatewayModels, ensureGatewayModels, gatewayModels } from './openrouter-models';

const LIVE = process.env.OPENROUTER_LIVE === '1';

describe.skipIf(!LIVE)('OpenRouter text catalogue live', () => {
  beforeEach(() => __resetGatewayModels());

  it('publishes distinct input and output prices for real text models', async () => {
    await ensureGatewayModels({ baseUrl: 'https://openrouter.ai/api/v1' });
    const priced = gatewayModels().filter((model) => model.rate.input > 0 && model.rate.output > 0);
    const rates = new Set(priced.map((model) => `${model.rate.input}:${model.rate.output}`));

    expect(priced.length).toBeGreaterThan(50);
    expect(rates.size).toBeGreaterThan(10);
  }, 30_000);
});
