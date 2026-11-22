import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createServer, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { Bridge, feegaSource } from './vite.ts';

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));
const VITE_CLIENT = '/app/node_modules/vite/dist/client/client.mjs';
const BRIDGE_IMPORT = /import "\/@fs.*\/bridge\.js";/;

type Transform = (code: string, id: string, options?: { ssr?: boolean }) => { code: string } | null;

const transformOf = (plugin: Plugin) => (plugin.transform as unknown as Transform).bind({} as never);

describe('feegaSource', () => {
  it('loads the bridge with the Vite client, so a SvelteKit page without index.html answers a click', () => {
    const out = transformOf(feegaSource())('export const hot = 1;', VITE_CLIENT);

    expect(out?.code).toMatch(BRIDGE_IMPORT);
    expect(out?.code).toContain('export const hot = 1;');
  });

  it('keeps the bridge out of the server render', () => {
    expect(transformOf(feegaSource())('export const hot = 1;', VITE_CLIENT, { ssr: true })).toBeNull();
  });

  it('leaves the Vite client alone when the page gets the bridge from the proxy', () => {
    expect(transformOf(feegaSource({ bridge: Bridge.Proxy }))('export const hot = 1;', VITE_CLIENT)).toBeNull();
  });

  it('leaves other dependencies untouched', () => {
    expect(transformOf(feegaSource())('export const a = 1;', '/app/node_modules/react/index.js')).toBeNull();
  });

  it('tagga i componenti anche quando sta dopo il plugin di Svelte, che altrimenti gli passa codice già compilato', async () => {
    const root = mkdtempSync(join(FIXTURES_DIR, '.order-'));
    writeFileSync(join(root, 'App.svelte'), '<script lang="ts">let n: number = 1;</script>\n<button id="buy">{n}</button>\n');
    const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [svelte(), feegaSource()] });

    try {
      const out = await server.transformRequest('/App.svelte');
      expect(out?.code).toContain('data-feega-src="App.svelte:2:1"');
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('names files from the project root when the framework serves from a subfolder', async () => {
    const root = mkdtempSync(join(FIXTURES_DIR, '.src-'));
    mkdirSync(join(root, 'app'));
    writeFileSync(join(root, 'app', 'App.svelte'), '<button id="buy">1</button>\n');
    const server = await createServer({ root: join(root, 'app'), configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [svelte(), feegaSource({ root })] });

    try {
      const out = await server.transformRequest('/App.svelte');
      expect(out?.code).toContain(`data-feega-src="app/App.svelte:1:1"`);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('tags the elements of index.html before Vite serves it', async () => {
    const root = mkdtempSync(join(FIXTURES_DIR, '.html-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html>\n<html><body>\n<h1>Hi</h1>\n</body></html>\n');
    const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, plugins: [feegaSource()] });

    try {
      const out = await server.transformIndexHtml('/index.html', '<!doctype html>\n<html><body>\n<h1>Hi</h1>\n</body></html>\n', '/index.html');
      expect(out).toContain('<h1 data-feega-src="index.html:3:1">Hi</h1>');
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
