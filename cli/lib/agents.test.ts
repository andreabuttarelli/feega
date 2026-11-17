import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { agentLines, listAgents, type Agent } from './agents.ts';

const CLAUDE: Agent = { id: 'claude', name: 'Claude Code', installed: true, version: '2.1.3', launch: 'adapter', auth: 'signed_in', install: 'curl x', login: 'claude /login' };
const GOOSE: Agent = { id: 'goose', name: 'Goose', installed: false, version: null, launch: 'none', auth: 'unknown', install: 'brew install block-goose-cli', login: null };
const CODEX: Agent = { id: 'codex', name: 'Codex CLI', installed: true, version: '0.157.1', launch: 'adapter', auth: 'needs_login', install: 'npm i', login: 'codex login' };

const seen: string[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ agents: [CLAUDE], chosen: 'claude' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('listAgents', () => {
  it('reads the agents a local instance detected', async () => {
    expect(await listAgents({ refresh: false })).toEqual({ agents: [CLAUDE], chosen: 'claude' });
    expect(seen.at(-1)).toBe('/api/v1/local/acp/agents');
  });

  it('asks for a fresh detection', async () => {
    await listAgents({ refresh: true });
    expect(seen.at(-1)).toBe('/api/v1/local/acp/agents?refresh=1');
  });
});

describe('agentLines', () => {
  it('prints version and status, and the command to copy when one is needed', () => {
    const lines = agentLines({ agents: [CLAUDE, CODEX, GOOSE], chosen: 'claude' });

    expect(lines[0]).toContain('Claude Code');
    expect(lines[0]).toContain('2.1.3');
    expect(lines[0]).toContain('ready');
    expect(lines[0]).toContain('*');
    expect(lines.join('\n')).toContain('codex login');
    expect(lines.join('\n')).toContain('brew install block-goose-cli');
  });
});
