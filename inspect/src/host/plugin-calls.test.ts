import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { OpKind } from '@feega/plugin-api/protocol';
import { PluginCall } from '../messages';
import { pluginCalls } from './plugin-calls';

function setup(files: Record<string, string> = {}, appDir = '') {
  const root = mkdtempSync(join(tmpdir(), 'plugin-calls-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const proposal = vi.fn(async () => ({ ok: true as const, path: '', written: '' }));
  const fetched = vi.fn(async () => new Response('hello', { status: 200 }));
  const run = pluginCalls({ root, appDir: () => appDir, propose: proposal, fetch: fetched as unknown as typeof fetch });
  return { run, proposal, fetched };
}

describe('pluginCalls', () => {
  it('says whether the app uses TypeScript', async () => {
    expect(await setup({ 'tsconfig.json': '{}' }).run({ call: PluginCall.Project })).toEqual({ ok: true, value: { typescript: true, publicDir: 'public', packages: {} } });
    expect(await setup().run({ call: PluginCall.Project })).toEqual({ ok: true, value: { typescript: false, publicDir: 'public', packages: {} } });
  });

  it('looks for tsconfig inside the app directory', async () => {
    expect(await setup({ 'apps/web/tsconfig.json': '{}' }, 'apps/web').run({ call: PluginCall.Project })).toEqual({ ok: true, value: { typescript: true, publicDir: 'public', packages: {} } });
  });

  it('lists the packages of the app, dependencies and dev dependencies', async () => {
    const manifest = JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^6.0.0' } });
    expect(await setup({ 'apps/web/package.json': manifest }, 'apps/web').run({ call: PluginCall.Project })).toMatchObject({ value: { packages: { react: '^19.0.0', vite: '^6.0.0' } } });
    expect(await setup({ 'package.json': '{broken' }).run({ call: PluginCall.Project })).toMatchObject({ value: { packages: {} } });
  });

  it('serves static files from static in a SvelteKit app', async () => {
    expect(await setup({ 'static/robots.txt': 'x' }).run({ call: PluginCall.Project })).toMatchObject({ value: { publicDir: 'static' } });
    expect(await setup({ 'static/a.txt': 'x', 'public/b.txt': 'y' }).run({ call: PluginCall.Project })).toMatchObject({ value: { publicDir: 'public' } });
  });

  it('reads a source file inside the workspace', async () => {
    const { run } = setup({ 'src/A.svelte': '<p/>' });
    expect(await run({ call: PluginCall.Source, at: 'src/A.svelte:1:1' })).toEqual({ ok: true, value: '<p/>' });
  });

  it('gives null for a file that is not there and refuses one outside the workspace', async () => {
    const { run } = setup();
    expect(await run({ call: PluginCall.Source, at: 'src/none.svelte:1:1' })).toEqual({ ok: true, value: null });
    expect(await run({ call: PluginCall.Source, at: '../x:1:1' })).toEqual({ ok: true, value: null });
  });

  it('hands a proposal to the edit engine and reports its outcome', async () => {
    const { run, proposal } = setup();
    const out = await run({ call: PluginCall.Propose, proposal: { label: 'x', ops: [{ kind: OpKind.Dependency, name: 'a', version: '1.0.0' }] } });
    expect(out).toEqual({ ok: true, value: { ok: true } });
    expect(proposal).toHaveBeenCalledOnce();
  });

  it('reports a refused proposal', async () => {
    const run = pluginCalls({ root: '/x', appDir: () => '', propose: async () => ({ ok: false, reason: 'nope' }), fetch });
    expect(await run({ call: PluginCall.Propose, proposal: { label: 'x', ops: [] } })).toEqual({ ok: true, value: { ok: false, reason: 'nope' } });
  });

  it('fetches text for a plugin', async () => {
    const { run, fetched } = setup();
    expect(await run({ call: PluginCall.Fetch, url: 'https://api.example.com/' })).toEqual({ ok: true, value: { status: 200, text: 'hello' } });
    expect(fetched).toHaveBeenCalledOnce();
  });

  it('turns a network failure into a refusal', async () => {
    const run = pluginCalls({ root: '/x', appDir: () => '', propose: vi.fn(), fetch: (async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch });
    expect(await run({ call: PluginCall.Fetch, url: 'https://api.example.com/' })).toEqual({ ok: false, reason: 'offline' });
  });
});
