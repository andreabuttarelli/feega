import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { effectsApi } from './effects.ts';

type Seen = { method: string; path: string; body: unknown };

const seen: Seen[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      seen.push({ method: req.method ?? '', path: req.url ?? '', body: raw ? JSON.parse(raw) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ effects: [], custom: [], effect: { id: 'fx-1' } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('effectsApi', () => {
  it('lists through the org effects endpoint', async () => {
    await effectsApi.list('t', 'org-1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/org/effects?org=org-1' });
  });

  it('writes a custom effect with its name, frag and params', async () => {
    await effectsApi.write('t', { name: 'vhs', frag: 'vec4 effect(vec2 uv) { return vec4(1.0); }', params: [] });

    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/api/v1/org/custom-effects', body: { name: 'vhs', params: [] } });
  });

  it('patches at a version', async () => {
    await effectsApi.patch('t', 'fx-1', { version: 3, edits: [{ find: 'a', replace: 'b' }] });

    expect(seen.at(-1)).toMatchObject({ method: 'PATCH', path: '/api/v1/org/custom-effects/fx-1', body: { version: 3 } });
  });
});
