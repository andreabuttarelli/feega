import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as listen, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { feegaSource } from './vite.ts';

const FILES: Record<string, string> = {
  'src/routes/for/[slug]/+page.svelte': '',
  'src/routes/for/[slug]/+page.ts': "import { load } from './data.ts';\nexport const entries = async () => (await load()).map((slug) => ({ slug }));",
  'src/routes/for/[slug]/data.ts': "export const load = async () => ['react', 'vue'];",
  'src/routes/shop/[cat]/[id]/+page.svelte': '',
  'src/routes/shop/[cat]/[id]/+page.server.ts': "export function entries() { return [{ id: 7 }]; }",
  'src/routes/shop/[cat]/+layout.ts': "export function entries() { return [{ cat: 'shoes' }, { cat: 'hats' }]; }",
  'src/routes/docs/[...rest]/+page.svelte': '',
  'src/routes/docs/[...rest]/+page.ts': "export const entries = () => [{ rest: ['a', 'b'] }, { rest: { nope: 1 } }];",
  'src/routes/broken/[x]/+page.svelte': '',
  'src/routes/broken/[x]/+page.ts': "export const entries = () => { throw new Error('db is down'); };",
  'src/routes/slow/[x]/+page.svelte': '',
  'src/routes/slow/[x]/+page.ts': 'export const entries = () => new Promise(() => undefined);',
  'src/routes/plain/[x]/+page.svelte': '',
  'src/routes/plain/[x]/+page.ts': 'export const prerender = true;',
  'src/routes/+page.svelte': ''
};

let root: string;
let vite: ViteDevServer;
let http: Server;
let base: string;

const ask = async (file: string) => (await fetch(`${base}/__feega/route-entries?${new URLSearchParams({ file })}`)).json();

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'feega-entries-'));
  for (const [file, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
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

describe('the route entries route', () => {
  it('runs entries of the page module, awaiting a function that loads data', async () => {
    expect(await ask('src/routes/for/[slug]/+page.svelte')).toEqual({ entries: [{ slug: 'react' }, { slug: 'vue' }], reasons: [] });
  });

  it('adds the entries of a parent layout and turns numbers into text', async () => {
    const body = await ask('src/routes/shop/[cat]/[id]/+page.svelte');

    expect(body.entries).toEqual([{ id: '7' }, { cat: 'shoes' }, { cat: 'hats' }]);
  });

  it('joins a catch-all array and skips a row it cannot read', async () => {
    expect((await ask('src/routes/docs/[...rest]/+page.svelte')).entries).toEqual([{ rest: 'a/b' }]);
  });

  it('returns the error as a reason instead of throwing', async () => {
    const body = await ask('src/routes/broken/[x]/+page.svelte');

    expect(body.entries).toEqual([]);
    expect(body.reasons[0]).toContain('db is down');
  });

  it('gives up on a generator that never resolves', async () => {
    const body = await ask('src/routes/slow/[x]/+page.svelte');

    expect(body.entries).toEqual([]);
    expect(body.reasons[0]).toContain('timed out');
  }, 10_000);

  it('has no reason when the route has no generator', async () => {
    expect(await ask('src/routes/plain/[x]/+page.svelte')).toEqual({ entries: [], reasons: [] });
  });

  it('refuses a path outside the project', async () => {
    expect((await fetch(`${base}/__feega/route-entries?file=../x.ts`)).status).toBe(400);
  });
});
