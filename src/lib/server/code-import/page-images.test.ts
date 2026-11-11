import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ownImages } from './page-images';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const servers: Server[] = [];

async function serve(handler: Handler): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function png(res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'image/png' });
  res.end(Buffer.from('png'));
}

function importerOf(seen: string[]) {
  return async (url: string) => (seen.push(url), 'asset');
}

afterEach(() => {
  servers.splice(0).forEach((server) => server.closeAllConnections());
});

describe('ownImages', () => {
  it('importa un\'immagine della propria origine', async () => {
    const own = await serve((_, res) => png(res));
    const seen: string[] = [];

    expect(await ownImages(importerOf(seen), [own])(`${own}/a.png`)).toBe('asset');
    expect(seen[0]).toMatch(/^data:image\/png;base64,/);
  });

  it('non segue un redirect verso un\'altra origine', async () => {
    let hits = 0;
    const other = await serve((_, res) => (hits++, png(res)));
    const own = await serve((_, res) => {
      res.writeHead(302, { location: `${other}/a.png` });
      res.end();
    });
    const seen: string[] = [];

    expect(await ownImages(importerOf(seen), [own])(`${own}/a.png`)).toBeNull();
    expect(hits).toBe(0);
    expect(seen).toEqual([]);
  });

  it('segue un redirect dentro la stessa origine', async () => {
    const own = await serve((req, res) => {
      if (req.url === '/a.png') {
        res.writeHead(302, { location: '/b.png' });
        return res.end();
      }
      png(res);
    });
    const seen: string[] = [];

    expect(await ownImages(importerOf(seen), [own])(`${own}/a.png`)).toBe('asset');
  });

  it('rifiuta un ciclo di redirect', async () => {
    const own = await serve((_, res) => {
      res.writeHead(302, { location: '/loop.png' });
      res.end();
    });

    expect(await ownImages(importerOf([]), [own])(`${own}/loop.png`)).toBeNull();
  });

  it('rifiuta un content-length sopra il tetto', async () => {
    const own = await serve((_, res) => {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': '16000000' });
      res.end(Buffer.alloc(16_000_000));
    });

    expect(await ownImages(importerOf([]), [own])(`${own}/big.png`)).toBeNull();
  });

  it('smette di leggere un corpo senza content-length oltre il tetto', async () => {
    let sent = 0;
    const own = await serve((_, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      const chunk = Buffer.alloc(1_000_000);
      const send = () => {
        while (!res.destroyed) {
          sent += chunk.length;
          if (!res.write(chunk)) {
            res.once('drain', send);
            return;
          }
        }
      };
      send();
    });

    expect(await ownImages(importerOf([]), [own])(`${own}/big.png`)).toBeNull();
    expect(sent).toBeLessThan(60_000_000);
  });
});
