import { describe, expect, it } from 'vitest';
import type { AgentEnv } from '../agents';
import { AcpId, acpAgents, launchOf } from './acp-agents';

const envWith = (held: string[]): AgentEnv => ({ path: ['/usr/bin'], home: '/home/me', exists: (p) => held.includes(p), appName: 'Visual Studio Code', extensions: [] });

const byId = (env: AgentEnv, id: AcpId) => acpAgents(env).find((a) => a.id === id)!;

describe('the ACP agent catalog', () => {
  it('marks nothing installed on a bare machine and tells how to install each', () => {
    const all = acpAgents(envWith([]));

    expect(all.every((a) => !a.installed)).toBe(true);
    expect(all.every((a) => a.install.length > 0)).toBe(true);
  });

  it('finds a native agent by its binary', () => {
    expect(byId(envWith(['/usr/bin/opencode']), AcpId.OpenCode).installed).toBe(true);
    expect(byId(envWith(['/usr/bin/grok']), AcpId.Grok).installed).toBe(true);
    expect(byId(envWith(['/usr/bin/gemini']), AcpId.Gemini).installed).toBe(true);
  });

  it('reuses the agent clues for Claude Code and Codex', () => {
    expect(byId(envWith(['/home/me/.claude']), AcpId.Claude).installed).toBe(true);
    expect(byId(envWith(['/home/me/.codex']), AcpId.Codex).installed).toBe(true);
  });

  it('flags the agents that run through an npx adapter', () => {
    const all = acpAgents(envWith([]));

    expect(all.filter((a) => a.adapter).map((a) => a.id)).toEqual([AcpId.Claude, AcpId.Codex]);
  });

  it('launches each agent the way its ACP entry says', () => {
    expect(launchOf(AcpId.OpenCode)).toEqual({ command: 'opencode', args: ['acp'] });
    expect(launchOf(AcpId.Gemini)).toEqual({ command: 'gemini', args: ['--acp'] });
    expect(launchOf(AcpId.Grok)).toEqual({ command: 'grok', args: ['agent', 'stdio'] });
    expect(launchOf(AcpId.Claude).command).toBe('npx');
    expect(launchOf(AcpId.Claude).args).toContain('@agentclientprotocol/claude-agent-acp@0.110.0');
  });
});
