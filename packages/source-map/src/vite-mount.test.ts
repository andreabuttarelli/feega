import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as listen, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { feegaSource } from './vite.ts';

const CARD = "export function Card({ size = 'sm', label }: { size?: 'sm' | 'lg'; label: string }) { return <h2>{label}</h2>; }\n";
const MAIN = "import { createRoot } from 'react-dom/client';\nimport { Theme } from './theme';\nimport { App } from './App';\ncreateRoot(document.body).render(<Theme><App /></Theme>);\n";
const INDEX = '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';

let root: string;
let vite: ViteDevServer;
let http: Server;
let base: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'feega-mount-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'index.html'), INDEX);
  writeFileSync(join(root, 'src/Card.tsx'), CARD);
  writeFileSync(join(root, 'src/main.tsx'), MAIN);
  for (const [name, main] of [['react', 'index.js'], ['react-dom', 'client.js']]) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true });
    writeFileSync(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '19.0.0', main, exports: { '.': `./${main}`, './client': './client.js' } }));
    writeFileSync(join(root, 'node_modules', name, main), 'export const createRoot = () => null;\n');
  }
  vite = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [feegaSource()] });
  http = listen(vite.middlewares).listen(0);
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  http.close();
  await vite.close();
  rmSync(root, { recursive: true, force: true });
});

describe('the props route', () => {
  it('describes the props of a component in the project', async () => {
    const body = await (await fetch(`${base}/__feega/props?file=src/Card.tsx&name=Card`)).json();

    expect(body.controls.map((c: { name: string }) => c.name)).toEqual(['size', 'label']);
  });

  it('answers with no controls for a file it cannot describe', async () => {
    const body = await (await fetch(`${base}/__feega/props?file=src/main.tsx&name=Nope`)).json();

    expect(body).toEqual({ controls: null });
  });

  it('refuses a path outside the project', async () => {
    expect((await fetch(`${base}/__feega/props?file=../x.tsx&name=A`)).status).toBe(400);
  });
});

describe('the mount route', () => {
  it('serves a page that renders the component through the Vite pipeline', async () => {
    const html = await (await fetch(`${base}/__feega/mount?file=src/Card.tsx&name=Card&props=${encodeURIComponent('{"label":"Hi"}')}`)).text();

    expect(html).toContain('/@vite/client');
    expect(html).toContain('/__feega/mount-module.js?file=src/Card.tsx');
  });

  it('serves the module that mounts it with the props asked for', async () => {
    const code = await (await fetch(`${base}/__feega/mount-module.js?file=src/Card.tsx&name=Card&props=${encodeURIComponent('{"label":"Hi"}')}`)).text();

    expect(code).toContain('src/Card.tsx";');
    expect(code).toContain('"label":"Hi"');
  });

  it('loads the providers the app entry wraps the app in', async () => {
    const code = await (await fetch(`${base}/__feega/mount-module.js?file=src/Card.tsx&name=Card`)).text();

    expect(code).toContain('/src/main.tsx?feega-providers');
  });

  it('builds the providers module from the app entry', async () => {
    const loaded = await vite.pluginContainer.load(`${join(root, 'src/main.tsx')}?feega-providers`);
    const code = typeof loaded === 'string' ? loaded : loaded?.code;

    expect(code).toContain('export function Providers');
    expect(code).toContain('<Theme>');
  });

  it('refuses a path outside the project', async () => {
    expect((await fetch(`${base}/__feega/mount?file=../x.tsx&name=A`)).status).toBe(400);
  });
});

describe('the mount route under a base', () => {
  it('points the page at the module under the base, as behind Nuxt', async () => {
    const based = await createServer({ root, configFile: false, base: '/_nuxt/', logLevel: 'silent', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [feegaSource()] });
    const server = listen(based.middlewares).listen(0);
    const port = (server.address() as AddressInfo).port;
    const html = await (await fetch(`http://127.0.0.1:${port}/__feega/mount?file=src/Card.tsx&name=Card`)).text();
    server.close();
    await based.close();

    expect(html).toContain('src="/_nuxt/__feega/mount-module.js?file=src/Card.tsx');
    expect(html).not.toContain('/_nuxt/_nuxt');
  });
});
