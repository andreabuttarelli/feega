import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fontsApi } from './fonts.ts';

const seen: { method: string; path: string; type: string; body: string }[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', path: req.url ?? '', type: req.headers['content-type'] ?? '', body: Buffer.concat(chunks).toString('latin1') });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fonts: [] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('fontsApi', () => {
  it('lists the org fonts', async () => {
    await fontsApi.list('t', 'org-1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/org/fonts?org=org-1' });
  });

  it('uploads a local file as multipart', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'fonts-')), 'Acme.woff2');
    writeFileSync(file, new Uint8Array([0x77, 0x4f, 0x46, 0x32]));

    await fontsApi.upload('t', file);

    expect(seen.at(-1)?.method).toBe('POST');
    expect(seen.at(-1)?.type).toContain('multipart/form-data');
    expect(seen.at(-1)?.body).toContain('filename="Acme.woff2"');
  });

  it('deletes a family by name', async () => {
    await fontsApi.remove('t', 'Acme Sans');

    expect(seen.at(-1)).toMatchObject({ method: 'DELETE', path: '/api/v1/org/fonts?family=Acme+Sans' });
  });
});
