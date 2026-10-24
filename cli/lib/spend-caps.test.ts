import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spendCapsApi } from './spend-caps.ts';

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
      res.end(JSON.stringify({ caps: [] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('spendCapsApi', () => {
  it('reads the caps of an org', async () => {
    await spendCapsApi.get('t', 'org-1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/org/spend-caps?org=org-1' });
  });

  it('sets and removes a cap with one call', async () => {
    await spendCapsApi.set('t', { scope: 'org_member', cap_usd: 10, reset: 'monthly' });
    await spendCapsApi.set('t', { scope: 'org_member', cap_usd: null });

    expect(seen.at(-2)).toMatchObject({ method: 'PUT', body: { scope: 'org_member', cap_usd: 10, reset: 'monthly' } });
    expect(seen.at(-1)).toMatchObject({ method: 'PUT', body: { scope: 'org_member', cap_usd: null } });
  });
});
