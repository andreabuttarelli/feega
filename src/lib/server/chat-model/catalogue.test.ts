import { describe, it, expect } from 'vitest';
import { CostTier } from '$lib/chat-model';
import type { GatewayModel } from '$lib/server/openrouter-models';
import { ChoiceError, chatModelOptions, reasoningProviderOptions, resolveChoice } from './catalogue';

const model = (over: Partial<GatewayModel>): GatewayModel => ({
  id: 'x/y',
  label: 'X: Y',
  contextLength: 1000,
  rate: { input: 1, cachedInput: 0.1, output: 1 },
  usable: true,
  tools: true,
  reasoning: false,
  efforts: [],
  defaultEffort: null,
  created: 0,
  ...over
});

const SONNET = model({
  id: 'anthropic/claude-sonnet-5.5',
  label: 'Anthropic: Claude Sonnet 5.5',
  rate: { input: 2, cachedInput: 0.2, output: 10 },
  reasoning: true,
  efforts: ['max', 'xhigh', 'high', 'medium', 'low'],
  defaultEffort: 'high'
});
const GLM = model({ id: 'z-ai/glm-5.3-flash', label: 'Z.ai: GLM 5.3 Flash', rate: { input: 0.15, cachedInput: 0.03, output: 0.5 }, reasoning: true, efforts: ['max', 'high', 'low'], defaultEffort: 'max' });
const PLAIN = model({ id: 'mistralai/plain', label: 'Mistral: Plain', rate: { input: 1, cachedInput: 1, output: 3 } });
const NO_TOOLS = model({ id: 'x/no-tools', tools: false, usable: false });
const VARIANT = model({ id: 'anthropic/claude-sonnet-5.5:free' });
const ROUTER = model({ id: '~anthropic/claude-sonnet-latest' });

const OPTIONS = chatModelOptions([SONNET, GLM, PLAIN, NO_TOOLS, VARIANT, ROUTER]);

describe('capability table from the catalogue', () => {
  it('offers only tool-calling models, without variants or aliases', () => {
    expect(OPTIONS.map((o) => o.id).sort()).toEqual(['anthropic/claude-sonnet-5.5', 'mistralai/plain', 'z-ai/glm-5.3-flash']);
  });

  it('carries provider, price tier and the declared efforts', () => {
    const sonnet = OPTIONS.find((o) => o.id === SONNET.id);
    expect(sonnet).toMatchObject({ provider: 'anthropic', costTier: CostTier.High, inputUsdPerM: 2, outputUsdPerM: 10, efforts: SONNET.efforts, defaultEffort: 'high' });
    expect(OPTIONS.find((o) => o.id === GLM.id)?.costTier).toBe(CostTier.Low);
    expect(OPTIONS.find((o) => o.id === PLAIN.id)?.costTier).toBe(CostTier.Mid);
  });

  it('a model without declared efforts has no reasoning control', () => {
    expect(OPTIONS.find((o) => o.id === PLAIN.id)?.efforts).toEqual([]);
  });
});

describe('server validation of the turn choice', () => {
  it('nothing asked: the default model at medium', () => {
    expect(resolveChoice(OPTIONS, {})).toEqual({ ok: true, choice: { model: SONNET.id, reasoning: 'medium' } });
  });

  it('a model asked without reasoning gets its declared default', () => {
    expect(resolveChoice(OPTIONS, { model: GLM.id })).toEqual({ ok: true, choice: { model: GLM.id, reasoning: 'max' } });
  });

  it('accepts an effort the model declares', () => {
    expect(resolveChoice(OPTIONS, { model: GLM.id, reasoning: 'low' })).toEqual({ ok: true, choice: { model: GLM.id, reasoning: 'low' } });
  });

  it('refuses a model outside the catalogue', () => {
    expect(resolveChoice(OPTIONS, { model: 'x/no-tools' })).toEqual({ ok: false, error: ChoiceError.UnknownModel });
    expect(resolveChoice(OPTIONS, { model: 42 })).toEqual({ ok: false, error: ChoiceError.UnknownModel });
  });

  it('refuses an effort the model does not declare', () => {
    expect(resolveChoice(OPTIONS, { model: GLM.id, reasoning: 'medium' })).toEqual({ ok: false, error: ChoiceError.UnsupportedReasoning });
    expect(resolveChoice(OPTIONS, { model: PLAIN.id, reasoning: 'low' })).toEqual({ ok: false, error: ChoiceError.UnsupportedReasoning });
  });

  it('a model without reasoning control runs with none', () => {
    expect(resolveChoice(OPTIONS, { model: PLAIN.id })).toEqual({ ok: true, choice: { model: PLAIN.id, reasoning: null } });
  });

  it('an empty catalogue still runs the default model, without reasoning it cannot verify', () => {
    expect(resolveChoice([], {})).toEqual({ ok: true, choice: { model: SONNET.id, reasoning: null } });
    expect(resolveChoice([], { model: GLM.id })).toEqual({ ok: false, error: ChoiceError.UnknownModel });
  });
});

describe('provider options on the wire', () => {
  it('an effort becomes reasoning.effort on a model the SDK would not treat as reasoning', () => {
    expect(reasoningProviderOptions('medium')).toEqual({ openai: { reasoningEffort: 'medium', forceReasoning: true } });
  });

  it('no reasoning sends nothing', () => {
    expect(reasoningProviderOptions(null)).toEqual({});
  });
});
