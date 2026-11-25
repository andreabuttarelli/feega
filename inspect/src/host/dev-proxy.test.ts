import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRIDGE_PATH, devProxy, withBridge } from './dev-proxy';
import { FEEGA_SERVER_HEADER, FeegaServer } from './feega-server';

describe('withBridge', () => {
  it('adds the bridge script before </head>', () => {
    expect(withBridge('<html><head><title>x</title></head><body></body></html>')).toBe(`<html><head><title>x</title><script type="module" src="${BRIDGE_PATH}bridge.js"></script></head><body></body></html>`);
  });

  it('a page without head gets it at the start of body', () => {
    expect(withBridge('<body>hi</body>')).toContain(`<body><script type="module" src="${BRIDGE_PATH}bridge.js"></script>hi`);
  });
});

describe('devProxy', () => {
  it('serves the page with the bridge and the bridge files themselves', async () => {
    const app = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<html><head></head><body></body>'));
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const target = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const dir = mkdtempSync(join(tmpdir(), 'bridge-'));
    writeFileSync(join(dir, 'bridge.js'), 'export {};');

    const proxy = await devProxy(target, dir);
    const page = await (await fetch(proxy.url)).text();
    const bridge = await fetch(`${proxy.url}${BRIDGE_PATH.slice(1)}bridge.js`);

    expect(page).toContain(`${BRIDGE_PATH}bridge.js`);
    expect(bridge.headers.get('content-type')).toContain('javascript');
    proxy.close();
    app.close();
  });

  it('passes the mount routes of the dev server through to it', async () => {
    const app = createServer((req, res) => res.writeHead(200, { 'content-type': 'text/plain' }).end(`app ${req.url}`));
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const target = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const proxy = await devProxy(target, tmpdir());

    const mount = await fetch(`${proxy.url}${BRIDGE_PATH.slice(1)}mount?file=a.astro`);

    expect(await mount.text()).toBe('app /__feega/mount?file=a.astro');
    proxy.close();
    app.close();
  });

  it('marks every reply as a Feega server so no other instance attaches to it', async () => {
    const app = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/css' }).end('a{}'));
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const target = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const proxy = await devProxy(target, tmpdir());

    const page = await fetch(proxy.url);
    const bridge = await fetch(`${proxy.url}${BRIDGE_PATH.slice(1)}bridge.js`);

    expect(page.headers.get(FEEGA_SERVER_HEADER)).toBe(FeegaServer.Proxy);
    expect(bridge.headers.get(FEEGA_SERVER_HEADER)).toBe(FeegaServer.Proxy);
    proxy.close();
    app.close();
  });
});

const BRIDGE_SOURCE = resolve(__dirname, '../../../packages/source-map/src');

function importsOf(file: string): string[] {
  const source = readFileSync(join(BRIDGE_SOURCE, file), 'utf8');
  return [...source.matchAll(/from '\.\/([^']+\.js)'/g)].map((m) => m[1]);
}

function closureOf(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) {
    return seen;
  }
  seen.add(file);
  importsOf(file).forEach((f) => closureOf(f, seen));
  return seen;
}

describe('bridge modules', () => {
  it('the proxy serves every module the bridge imports', async () => {
    const app = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<html><head></head></html>'));
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const proxy = await devProxy(`http://127.0.0.1:${(app.address() as { port: number }).port}`, BRIDGE_SOURCE);

    const statuses = await Promise.all([...closureOf('bridge.js')].map(async (f) => [f, (await fetch(`${proxy.url}${BRIDGE_PATH.slice(1)}${f}`)).status]));

    proxy.close();
    app.close();
    expect(statuses.filter(([, status]) => status !== 200)).toEqual([]);
  });
});
