import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { canvasApi } from './canvas.ts';

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
      res.end(JSON.stringify({ nodes: [] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('canvasApi', () => {
  it('runs one canvas op on a project through the org canvas endpoint', async () => {
    await canvasApi.run('t', { project: 'p-1', op: 'list_nodes', input: { canvasId: 'c-1' } }, 'org-1');

    expect(seen.at(-1)).toEqual({
      method: 'POST',
      path: '/api/v1/org/canvas?org=org-1',
      body: { project_id: 'p-1', op: 'list_nodes', input: { canvasId: 'c-1' } }
    });
  });

  it('sends an empty input when the op takes none', async () => {
    await canvasApi.run('t', { project: 'p-1', op: 'list_canvases' });

    expect(seen.at(-1)).toMatchObject({ path: '/api/v1/org/canvas', body: { input: {} } });
  });
});
