import { afterAll, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SESSION_HEADER } from './contracts/index.ts';
import { inSession, request } from './api.ts';

const seen: (string | null)[] = [];

const fake: Server = createServer((req, res) => {
  seen.push((req.headers[SESSION_HEADER] as string | undefined) ?? null);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{}');
});

await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;

afterAll(() => fake.close());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('every call carries the session it belongs to', () => {
  test('one process is one session', async () => {
    seen.length = 0;
    await request('/api/v1/a', 't');
    await request('/api/v1/b', 't');

    expect(seen[0]).toMatch(UUID);
    expect(seen[1]).toBe(seen[0]);
  });

  test('a declared connection is its own session, the same on every call', async () => {
    seen.length = 0;
    await inSession('mcp-1', () => request('/api/v1/a', 't'));
    await inSession('mcp-1', () => request('/api/v1/a', 't'));
    await inSession('mcp-2', () => request('/api/v1/a', 't'));

    expect(seen[0]).toMatch(UUID);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[0]);
  });

  test('a shared host with no connection id sends none', async () => {
    seen.length = 0;
    await inSession(null, () => request('/api/v1/a', 't'));

    expect(seen[0]).toBeNull();
  });
});
