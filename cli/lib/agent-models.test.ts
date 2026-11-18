import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { listModels, modelLines, setModel, type ModelListing } from './agent-models.ts';

const LISTING: ModelListing = {
  models: [
    { id: 'gpt-5.6-sol', name: '5.6 Sol', description: null },
    { id: 'gpt-6-luna', name: '6 Luna', description: 'Fast and affordable' }
  ],
  current: 'gpt-5.6-sol',
  chosen: 'gpt-6-luna'
};

const seen: { method: string; url: string; body: string }[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', body });
      if (req.method === 'PUT') {
        res.writeHead(body.includes('made-up') ? 400 : 204);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(LISTING));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('listModels', () => {
  it('reads the models the live agent offers', async () => {
    expect(await listModels('codex', { refresh: false })).toEqual(LISTING);
    expect(seen.at(-1)?.url).toBe('/api/v1/local/acp/agents/codex/models');
  });

  it('asks the agent again on refresh', async () => {
    await listModels('codex', { refresh: true });
    expect(seen.at(-1)?.url).toBe('/api/v1/local/acp/agents/codex/models?refresh=1');
  });
});

describe('setModel', () => {
  it('saves the model for the agent', async () => {
    await setModel('codex', 'gpt-6-luna');
    expect(seen.at(-1)).toEqual({ method: 'PUT', url: '/api/v1/local/acp/agents/codex/models', body: JSON.stringify({ model: 'gpt-6-luna' }) });
  });

  it('fails on a model the agent does not offer', async () => {
    await expect(setModel('codex', 'made-up')).rejects.toThrow('400');
  });
});

describe('modelLines', () => {
  it('marks the chosen model and the agent default', () => {
    const lines = modelLines(LISTING);

    expect(lines[0]).toContain('gpt-5.6-sol');
    expect(lines[0]).toContain('default');
    expect(lines[1].startsWith('*')).toBe(true);
    expect(lines[1]).toContain('6 Luna');
  });

  it('says so when the agent offers no model choice', () => {
    expect(modelLines({ models: null, current: null, chosen: null })).toEqual(['This agent does not let a client pick its model.']);
  });
});
