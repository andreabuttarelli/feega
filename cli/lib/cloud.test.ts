import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { cloudApi, figmaTokenApi } from './cloud.ts';

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
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('cloudApi', () => {
  it('lists the providers and their connection', async () => {
    await cloudApi.providers('t', 'p1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/projects/p1/cloud' });
  });

  it('lists a folder, and the next page by cursor', async () => {
    await cloudApi.files('t', 'p1', 'dropbox', { folder: '/shots', cursor: 'c1' });

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/projects/p1/cloud/dropbox/files?folder=%2Fshots&cursor=c1' });
  });

  it('imports a file onto a canvas', async () => {
    await cloudApi.importFile('t', 'p1', 'google_drive', { fileId: 'f1', place: { canvasId: 'c1', x: 1, y: 2 } });

    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/api/v1/projects/p1/cloud/google_drive/import', body: { fileId: 'f1', place: { canvasId: 'c1', x: 1, y: 2 } } });
  });

  it('exports an asset into a folder', async () => {
    await cloudApi.exportAsset('t', 'p1', 'dropbox', { assetId: 'a1', folder: '/out', name: 'x.png' });

    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/api/v1/projects/p1/cloud/dropbox/export', body: { assetId: 'a1', folder: '/out', name: 'x.png' } });
  });

  it('disconnects a provider', async () => {
    await cloudApi.disconnect('t', 'p1', 'dropbox');

    expect(seen.at(-1)).toMatchObject({ method: 'DELETE', path: '/api/v1/projects/p1/cloud/dropbox' });
  });
});

describe('figmaTokenApi', () => {
  it('asks whether a token is saved', async () => {
    await figmaTokenApi.status('t', 'p1');

    expect(seen.at(-1)).toMatchObject({ method: 'GET', path: '/api/v1/projects/p1/figma-token' });
  });
});
