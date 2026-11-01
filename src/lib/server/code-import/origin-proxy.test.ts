import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ORIGIN_PROXY } from './origin-proxy';

const running: (ChildProcess | Server)[] = [];

afterEach(() => {
  for (const r of running.splice(0)) {
    if ('kill' in r) {
      r.kill();
      continue;
    }
    r.close();
  }
});

async function target(): Promise<{ port: number }> {
  const server = createServer((req, res) => res.end(JSON.stringify({ host: req.headers.host, origin: req.headers.origin ?? null, path: req.url })));
  server.on('upgrade', (req, socket) => socket.end(`HTTP/1.1 101 Switching Protocols\r\nx-origin: ${req.headers.origin}\r\nx-host: ${req.headers.host}\r\n\r\n`));
  running.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return { port: (server.address() as AddressInfo).port };
}

async function proxied(listen: number, to: number) {
  const file = join(mkdtempSync(join(tmpdir(), 'proxy-')), 'proxy.cjs');
  writeFileSync(file, ORIGIN_PROXY);
  const child = spawn(process.execPath, [file, String(listen), String(to)], { stdio: 'ignore' });
  running.push(child);
  for (let i = 0; i < 50; i++) {
    const up = await new Promise<boolean>((done) => {
      const probe = connect(listen, '127.0.0.1');
      probe.on('connect', () => {
        probe.end();
        done(true);
      });
      probe.on('error', () => done(false));
    });
    if (up) {
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

const freePort = async () => {
  const s = createServer();
  await new Promise<void>((done) => s.listen(0, '127.0.0.1', done));
  const port = (s.address() as AddressInfo).port;
  s.close();
  return port;
};

describe('ORIGIN_PROXY', () => {
  it('il dev server vede la richiesta come venuta da localhost', async () => {
    const { port } = await target();
    const listen = await freePort();
    await proxied(listen, port);

    const body = await new Promise<string>((done) => {
      request({ host: '127.0.0.1', port: listen, path: '/_next/x?y=1', headers: { host: 'sb-1.vercel.run', origin: 'https://sb-1.vercel.run' } }, (res) => {
        let text = '';
        res.on('data', (c) => (text += c)).on('end', () => done(text));
      }).end();
    });

    expect(JSON.parse(body)).toEqual({ host: `localhost:${port}`, origin: `http://localhost:${port}`, path: '/_next/x?y=1' });
  });

  it('anche l\'upgrade del websocket arriva con l\'origine riscritta', async () => {
    const { port } = await target();
    const listen = await freePort();
    await proxied(listen, port);

    const head = await new Promise<string>((done) => {
      const socket = connect(listen, '127.0.0.1', () => socket.write('GET /_next/hmr HTTP/1.1\r\nHost: sb-1.vercel.run\r\nOrigin: https://sb-1.vercel.run\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
      let text = '';
      socket.on('data', (c) => (text += c)).on('end', () => done(text)).on('close', () => done(text));
    });

    expect(head).toContain('101');
    expect(head).toContain(`x-origin: http://localhost:${port}`);
    expect(head).toContain(`x-host: localhost:${port}`);
  });
});
