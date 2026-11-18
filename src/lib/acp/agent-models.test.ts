import { describe, expect, it } from 'vitest';
import { groupModels, type AgentModel } from './agent-models';

const model = (id: string, name = id): AgentModel => ({ id, name, description: null });

const OPENCODE = [model('google/gemini-2.5-pro', 'Google/Gemini 2.5 Pro'), model('anthropic/claude-sonnet', 'Anthropic/Claude Sonnet'), model('google/gemini-2.5-flash', 'Google/Gemini 2.5 Flash')];

describe('groupModels', () => {
  it('groups ids with a provider prefix by provider, in the order they come', () => {
    expect(groupModels(OPENCODE, '')).toEqual([
      { provider: 'google', models: [OPENCODE[0], OPENCODE[2]] },
      { provider: 'anthropic', models: [OPENCODE[1]] }
    ]);
  });

  it('keeps ids without a prefix in one unnamed group', () => {
    expect(groupModels([model('opus'), model('haiku')], '')).toEqual([{ provider: null, models: [model('opus'), model('haiku')] }]);
  });

  it('filters by name or id, ignoring case and dropping empty groups', () => {
    expect(groupModels(OPENCODE, 'FLASH')).toEqual([{ provider: 'google', models: [OPENCODE[2]] }]);
    expect(groupModels(OPENCODE, 'anthropic/')).toEqual([{ provider: 'anthropic', models: [OPENCODE[1]] }]);
  });
});
