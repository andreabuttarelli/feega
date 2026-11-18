import { describe, expect, it } from 'vitest';
import { AcpLaunch, AgentAuth } from '$lib/acp/detected-agent';
import { AGENT_CATALOG, detectAgents, type DetectHost } from './detect';

const HOME = '/Users/me';

type Fake = { files?: string[]; dirs?: Record<string, string[]>; outputs?: Record<string, string>; env?: Record<string, string> };

function host({ files = [], dirs = {}, outputs = {}, env = {} }: Fake): DetectHost & { ran: string[] } {
  const ran: string[] = [];
  return {
    ran,
    env: { HOME, PATH: '/usr/bin:/opt/homebrew/bin', ...env },
    fs: {
      executable: async (path) => files.includes(path),
      exists: async (path) => files.includes(path),
      list: async (dir) => dirs[dir] ?? []
    },
    run: async (command, args) => {
      ran.push([command, ...args].join(' '));
      return outputs[command] ?? null;
    }
  };
}

const find = async (fake: Fake, id: string) => (await detectAgents(host(fake))).find((a) => a.id === id)!;

describe('detectAgents', () => {
  it('lists every catalog agent, installed or not', async () => {
    const agents = await detectAgents(host({}));

    expect(agents.map((a) => a.id)).toEqual(AGENT_CATALOG.map((r) => r.id));
    expect(agents.every((a) => !a.installed && a.launch === AcpLaunch.None)).toBe(true);
  });

  it('finds a binary on PATH and reads its version', async () => {
    const gemini = await find({ files: ['/opt/homebrew/bin/gemini'], outputs: { '/opt/homebrew/bin/gemini': '0.68.0\n' } }, 'gemini');

    expect(gemini).toMatchObject({ installed: true, version: '0.68.0', launch: AcpLaunch.Native });
  });

  it('finds a binary in a common install dir that PATH misses', async () => {
    const claude = await find({ files: [`${HOME}/.local/bin/claude`], outputs: { [`${HOME}/.local/bin/claude`]: '2.1.3 (Claude Code)' } }, 'claude');

    expect(claude).toMatchObject({ installed: true, version: '2.1.3' });
  });

  it('finds a binary in the npx cache', async () => {
    const npx = `${HOME}/.npm/_npx`;
    const qwen = await find({ dirs: { [npx]: ['a1b2'] }, files: [`${npx}/a1b2/node_modules/.bin/qwen`] }, 'qwen');

    expect(qwen.installed).toBe(true);
  });

  it('launches through the adapter only when npx is there to run it', async () => {
    const files = [`${HOME}/.local/bin/codex`];

    expect((await find({ files }, 'codex')).launch).toBe(AcpLaunch.None);
    expect((await find({ files: [...files, '/usr/bin/npx'] }, 'codex')).launch).toBe(AcpLaunch.Adapter);
  });

  it('calls an agent signed in when its credentials file exists, without reading it', async () => {
    const codex = await find({ files: [`${HOME}/.local/bin/codex`, `${HOME}/.codex/auth.json`] }, 'codex');

    expect(codex.auth).toBe(AgentAuth.SignedIn);
  });

  it('calls an agent signed in when its API key is in the environment', async () => {
    const codex = await find({ files: [`${HOME}/.local/bin/codex`], env: { OPENAI_API_KEY: 'sk' } }, 'codex');

    expect(codex.auth).toBe(AgentAuth.SignedIn);
  });

  it('asks for login when a file-based agent has no credentials', async () => {
    const codex = await find({ files: [`${HOME}/.local/bin/codex`] }, 'codex');

    expect(codex).toMatchObject({ auth: AgentAuth.NeedsLogin, login: 'codex login' });
  });

  it('says unknown when the credentials may live in the keychain', async () => {
    const claude = await find({ files: [`${HOME}/.local/bin/claude`] }, 'claude');

    expect(claude.auth).toBe(AgentAuth.Unknown);
  });

  it('keeps an installed agent whose version probe timed out', async () => {
    const gemini = await find({ files: ['/opt/homebrew/bin/gemini'] }, 'gemini');

    expect(gemini).toMatchObject({ installed: true, version: null });
  });

  it('runs only version probes, never an install', async () => {
    const fake = host({ files: ['/opt/homebrew/bin/gemini', `${HOME}/.local/bin/claude`] });
    await detectAgents(fake);

    expect([...fake.ran].sort()).toEqual(['/opt/homebrew/bin/gemini --version', `${HOME}/.local/bin/claude --version`].sort());
  });
});
