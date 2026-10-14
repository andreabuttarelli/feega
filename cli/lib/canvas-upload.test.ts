import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { canvasApi, mimeTypeOf } from './canvas.ts';

type Seen = { method: string; path: string; type?: string; body: string };

const seen: Seen[] = [];
let server: Server;
let base = '';

const ANSWERS: Record<string, () => unknown> = {
  request_upload: () => ({ path: 'org/p-1/u-shot.png', uploadUrl: `${base}/storage/upload?token=t` }),
  list_canvases: () => ({ canvases: [{ id: 'c-first' }, { id: 'c-second' }] }),
  register_upload: () => ({ node: { id: 'n-1', type: 'image' }, asset: { id: 'a-1' } })
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      seen.push({ method: req.method ?? '', path: req.url ?? '', type: req.headers['content-type'], body });
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

describe('canvasApi.upload: a local file becomes a node on a canvas', () => {
  it('asks a signed url, puts the bytes there, then registers the file on the first canvas', async () => {
    const out = await canvasApi.upload('t', { project: 'p-1', fileName: 'shot.png', bytes: new TextEncoder().encode('png!') });

    expect(out).toMatchObject({ node: { id: 'n-1' }, asset: { id: 'a-1' } });
    const put = seen.find((s) => s.method === 'PUT')!;
    expect(put).toMatchObject({ path: '/storage/upload?token=t', type: 'image/png', body: 'png!' });
    const register = JSON.parse(seen.at(-1)!.body);
    expect(register).toMatchObject({ op: 'register_upload', input: { canvasId: 'c-first', path: 'org/p-1/u-shot.png', fileName: 'shot.png', mimeType: 'image/png', bytes: 4 } });
  });

  it('stops before uploading when the server refuses the file', async () => {
    ANSWERS.request_upload = () => ({ error: 'invalid_upload', message: 'Image: at most 4MB' });
    seen.length = 0;

    await expect(canvasApi.upload('t', { project: 'p-1', fileName: 'shot.png', bytes: new Uint8Array(1), canvasId: 'c-1' })).rejects.toThrow('Image: at most 4MB');
    expect(seen.some((s) => s.method === 'PUT')).toBe(false);
  });

  it('reads the type of a file from its extension', () => {
    expect(mimeTypeOf('a.MP4')).toBe('video/mp4');
    expect(mimeTypeOf('notes.md')).toBe('text/markdown');
    expect(mimeTypeOf('blob')).toBe('application/octet-stream');
  });
});
