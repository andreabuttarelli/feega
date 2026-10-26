import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { canvasApi } from './canvas.ts';

type Seen = { method: string; path: string; type?: string; body: string };

const seen: Seen[] = [];
let server: Server;
let base = '';

const ANSWERS: Record<string, () => unknown> = {
  export_canvas_file: () => ({ name: 'Launch.feega', bytes: 4, url: `${base}/storage/file` }),
  request_canvas_import: () => ({ path: 'org/p-1/imports/x.feega', uploadUrl: `${base}/storage/upload?token=t`, mimeType: 'application/vnd.feega+zip' }),
  import_canvas_file: () => ({ canvas: { id: 'c-new', name: 'Launch' }, path: '/p/p-1/c/c-new' })
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      seen.push({ method: req.method ?? '', path: req.url ?? '', type: req.headers['content-type'], body });
      if (req.url === '/storage/file') {
        res.writeHead(200);
        res.end('zip!');
        return;
      }
      const op = req.url?.startsWith('/api/') ? (JSON.parse(body) as { op: string }).op : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(op ? ANSWERS[op]!() : {}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.PUBLIC_APP_URL = base;
});

afterAll(() => {
  server.close();
});

describe('a canvas as a .feega file on disk', () => {
  it('saves a canvas: the server packs it, the bytes come back with the file name', async () => {
    const out = await canvasApi.saveFile('t', { project: 'p-1', canvasId: 'c-1' });

    expect(out.name).toBe('Launch.feega');
    expect(new TextDecoder().decode(out.bytes)).toBe('zip!');
  });

  it('imports a file: signed url, the bytes put there, then the import of that path', async () => {
    seen.length = 0;
    const out = await canvasApi.importFile('t', { project: 'p-1', bytes: new TextEncoder().encode('zip!') });

    expect(out).toMatchObject({ canvas: { id: 'c-new' }, path: '/p/p-1/c/c-new' });
    expect(seen.find((s) => s.method === 'PUT')).toMatchObject({ path: '/storage/upload?token=t', type: 'application/vnd.feega+zip', body: 'zip!' });
    expect(JSON.parse(seen.at(-1)!.body)).toMatchObject({ op: 'import_canvas_file', input: { path: 'org/p-1/imports/x.feega' } });
  });
});
