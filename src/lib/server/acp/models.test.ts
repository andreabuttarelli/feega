import { describe, expect, it } from 'vitest';
import { modelsOf, switchesFor, type NewSession } from './models';

const select = (id: string, category: string, currentValue: string, values: string[]) => ({ id, category, type: 'select', currentValue, options: values.map((value) => ({ value, name: value.toUpperCase() })) });

const CLAUDE_LIKE: NewSession = {
  sessionId: 's',
  configOptions: [select('model', 'model', 'fable', ['fable', 'opus']), select('effort', 'thought_level', 'high', ['low', 'high', 'max'])]
};

const CODEX_LIKE: NewSession = {
  sessionId: 's',
  configOptions: [select('model', 'model', 'sol', ['sol', 'luna'])],
  models: { currentModelId: 'sol[xhigh]', availableModels: ['luna[low]', 'luna[high]'].map((modelId) => ({ modelId, name: modelId })) }
};

const have = (model: string, effort: string | null) => ({ model, effort });

describe('the efforts an agent offers', () => {
  it('reads a thought-level option as the effort of every model', () => {
    const offered = modelsOf(CLAUDE_LIKE)!;

    expect(offered.effort).toBe('high');
    expect(offered.models.map((m) => m.efforts)).toEqual([['low', 'high', 'max'], ['low', 'high', 'max']]);
  });

  it('reads model[effort] variants as the efforts of that model only', () => {
    const offered = modelsOf(CODEX_LIKE)!;

    expect(offered.effort).toBe('xhigh');
    expect(offered.models).toEqual([
      { id: 'sol', name: 'SOL', description: null, efforts: [] },
      { id: 'luna', name: 'LUNA', description: null, efforts: ['low', 'high'] }
    ]);
  });
});

describe('switching model and effort before a turn', () => {
  it('sets the thought-level option when only the effort changes', () => {
    expect(switchesFor(CLAUDE_LIKE, have('fable', 'high'), { model: null, effort: 'max' })).toEqual({
      switches: [{ method: 'session/set_config_option', params: { sessionId: 's', configId: 'effort', value: 'max' } }],
      now: have('fable', 'max')
    });
  });

  it('sets model then effort, and nothing when both already hold', () => {
    expect(switchesFor(CLAUDE_LIKE, have('fable', 'high'), { model: 'opus', effort: 'low' }).switches.map((s) => s.params.value)).toEqual(['opus', 'low']);
    expect(switchesFor(CLAUDE_LIKE, have('opus', 'low'), { model: 'opus', effort: 'low' }).switches).toEqual([]);
  });

  it('picks the model[effort] variant in one call when effort comes from variants', () => {
    expect(switchesFor(CODEX_LIKE, have('sol', 'xhigh'), { model: 'luna', effort: 'high' })).toEqual({
      switches: [{ method: 'session/set_model', params: { sessionId: 's', modelId: 'luna[high]' } }],
      now: have('luna', 'high')
    });
  });

  it('ignores an effort the chosen model does not offer, and an unknown model', () => {
    expect(switchesFor(CODEX_LIKE, have('sol', 'xhigh'), { model: 'sol', effort: 'low' }).switches).toEqual([]);
    expect(switchesFor(CLAUDE_LIKE, have('fable', 'high'), { model: 'gone', effort: 'nope' }).switches).toEqual([]);
  });
});
