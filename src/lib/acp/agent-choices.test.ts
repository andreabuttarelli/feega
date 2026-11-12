import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcpAgent, readAcpAgent, writeAcpAgent } from './agent-choices';

const stored = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => stored.set(k, v),
  removeItem: (k: string) => stored.delete(k)
});

describe('agent preference', () => {
  beforeEach(() => stored.clear());

  it('starts with no agent', () => {
    expect(readAcpAgent()).toBeNull();
  });

  it('remembers the chosen agent and forgets it when cleared', () => {
    writeAcpAgent(AcpAgent.Gemini);
    expect(readAcpAgent()).toBe(AcpAgent.Gemini);

    writeAcpAgent(null);
    expect(readAcpAgent()).toBeNull();
  });

  it('ignores a stored value that is no longer an agent', () => {
    localStorage.setItem('feega.acpAgent', 'cursor');
    expect(readAcpAgent()).toBeNull();
  });
});
