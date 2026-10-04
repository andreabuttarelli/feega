import { describe, it, expect, beforeEach } from 'vitest';
import { __resetGatewayModels, ensureGatewayModels, gatewayModel } from './openrouter-models';

const MODELS = {
  data: [
    {
      id: 'anthropic/claude-sonnet-5.5',
      name: 'Anthropic: Claude Sonnet 5.5',
      supported_parameters: ['tools', 'reasoning', 'reasoning_effort'],
      architecture: { input_modalities: ['text', 'image'] },
      reasoning: { mandatory: true, supported_efforts: ['max', 'xhigh', 'high', 'medium', 'low'], default_effort: 'high' },
      pricing: { prompt: '0.000002', completion: '0.00001' }
    },
    {
      id: 'deepseek/text-tools',
      name: 'DeepSeek: Text',
      supported_parameters: ['tools', 'reasoning'],
      architecture: { input_modalities: ['text'] },
      reasoning: { mandatory: false },
      pricing: { prompt: '0.000001', completion: '0.000002' }
    }
  ]
};

const fetchImpl = (async () => ({ ok: true, status: 200, json: async () => MODELS })) as unknown as typeof fetch;

beforeEach(() => __resetGatewayModels());

describe('gateway capabilities for the chat picker', () => {
  it('reads the efforts the gateway declares and the default one', async () => {
    await ensureGatewayModels({ fetchImpl, baseUrl: 'https://openrouter.ai/api/v1' });
    expect(gatewayModel('anthropic/claude-sonnet-5.5')).toMatchObject({
      tools: true,
      reasoning: true,
      efforts: ['max', 'xhigh', 'high', 'medium', 'low'],
      defaultEffort: 'high'
    });
  });

  it('tool calling is its own fact, apart from reading images', async () => {
    await ensureGatewayModels({ fetchImpl, baseUrl: 'https://openrouter.ai/api/v1' });
    expect(gatewayModel('deepseek/text-tools')).toMatchObject({ tools: true, usable: false, efforts: [], defaultEffort: null });
  });
});
