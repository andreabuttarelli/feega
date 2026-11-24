import { describe, expect, it } from 'vitest';
import { AgentId } from '../messages';
import { detectAgents, type AgentEnv } from './agents';

const envWith = (held: string[], rest: Partial<AgentEnv> = {}): AgentEnv => ({ path: ['/usr/bin', '/opt/bin'], home: '/home/me', exists: (p) => held.includes(p), appName: 'Visual Studio Code', extensions: [], ...rest });

describe('detectAgents', () => {
  it('finds nothing on a bare machine', () => {
    expect(detectAgents(envWith([]))).toEqual([]);
  });

  it('finds a binary on any PATH directory', () => {
    expect(detectAgents(envWith(['/opt/bin/claude']))).toEqual([AgentId.ClaudeCode]);
  });

  it('finds an agent by its config directory in home', () => {
    expect(detectAgents(envWith(['/home/me/.codex']))).toEqual([AgentId.Codex]);
    expect(detectAgents(envWith(['/home/me/.gemini']))).toEqual([AgentId.Gemini]);
  });

  it('finds the editor Feega runs in by its app name', () => {
    expect(detectAgents(envWith([], { appName: 'Cursor' }))).toEqual([AgentId.Cursor]);
    expect(detectAgents(envWith([], { appName: 'Windsurf' }))).toEqual([AgentId.Windsurf]);
  });

  it('finds Copilot by its installed extension', () => {
    expect(detectAgents(envWith([], { extensions: ['github.copilot-chat'] }))).toEqual([AgentId.Copilot]);
  });

  it('lists every agent found, once, in the table order', () => {
    const held = ['/usr/bin/claude', '/home/me/.claude', '/home/me/.gemini'];

    expect(detectAgents(envWith(held, { appName: 'Cursor' }))).toEqual([AgentId.ClaudeCode, AgentId.Cursor, AgentId.Gemini]);
  });

  it('does not throw when the file system does', () => {
    const broken = envWith([], { exists: () => { throw new Error('EACCES'); } });

    expect(detectAgents(broken)).toEqual([]);
  });
});
