import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { modelAllowlistApi } from './model-allowlist.ts';

const seen: { method: string; path: string; body: unknown }[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      seen.push({ method: req.method ?? '', path: req.url ?? '', body: raw ? JSON.parse(raw) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ image: [], video: [], model3d: [] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('modelAllowlistApi', () => {
  it('reads the lists of an org', async () => {
    await modelAllowlistApi.get('t', 'org-1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/org/model-allowlist?org=org-1' });
  });

  it('replaces the list of one medium', async () => {
    await modelAllowlistApi.set('t', { medium: 'video', model_ids: ['a'] });

    expect(seen.at(-1)).toMatchObject({ method: 'PUT', path: '/api/v1/org/model-allowlist', body: { medium: 'video', model_ids: ['a'] } });
  });
});
