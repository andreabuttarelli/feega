import { describe, expect, it } from 'vitest';
import { AGENT_DECIDED_KEYS, AgentKey, launchKey } from './actor';

describe('who launched a run is decided by the caller, not the route', () => {
  it('a person in the app launches a loop or a studio batch: never counted as an agent edit', () => {
    expect(AGENT_DECIDED_KEYS).not.toContain(launchKey(AgentKey.Loop, { apiKeyId: null }));
    expect(AGENT_DECIDED_KEYS).not.toContain(launchKey(AgentKey.Studio, {}));
  });

  it('the same run launched with an API key is an agent decision, and counts', () => {
    expect(launchKey(AgentKey.Loop, { apiKeyId: 'key-1' })).toBe(AgentKey.ApiKey);
    expect(AGENT_DECIDED_KEYS).toContain(launchKey(AgentKey.Studio, { apiKeyId: 'key-1' }));
  });
});
