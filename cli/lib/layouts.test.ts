import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { layoutsApi } from './layouts.ts';

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
      res.end(JSON.stringify({ layouts: [], layout: { id: 'lay-1' } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('layoutsApi', () => {
  it('writes a spec layout by name', async () => {
    await layoutsApi.write('t', { name: 'orbit', spec: { kind: 'spec' } }, 'org-1');

    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/api/v1/org/layouts?org=org-1', body: { name: 'orbit' } });
  });

  it('patches at a version', async () => {
    await layoutsApi.patch('t', 'lay-1', { version: 2, spec: { kind: 'spec' } });

    expect(seen.at(-1)).toMatchObject({ method: 'PATCH', path: '/api/v1/org/layouts/lay-1', body: { version: 2 } });
  });
});
