import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { studioApi } from './studio.ts';

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
      res.end(JSON.stringify({}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('studioApi', () => {
  it('quotes a selection in a project', async () => {
    await studioApi.quote('t', { name: 'Mugs' }, 'proj-1');

    expect(seen.at(-1)).toEqual({ method: 'POST', path: '/api/v1/studio/quote?project=proj-1', body: { selection: { name: 'Mugs' } } });
  });

  it('starts only with the quote id', async () => {
    await studioApi.start('t', { name: 'Mugs' }, 'q-1');

    expect(seen.at(-1)).toEqual({ method: 'POST', path: '/api/v1/studio/start', body: { selection: { name: 'Mugs' }, quoteId: 'q-1' } });
  });

  it('reads a batch', async () => {
    await studioApi.status('t', 'b-1');

    expect(seen.at(-1)?.path).toBe('/api/v1/studio/b-1');
  });

  it('runs an action on a batch with its items', async () => {
    await studioApi.act('t', 'b-1', 'retry', { itemIds: ['i1'] });

    expect(seen.at(-1)).toEqual({ method: 'POST', path: '/api/v1/studio/b-1?action=retry', body: { itemIds: ['i1'] } });
  });
});
