import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { tarball } from '../../packages/plugin-store/src/tar-fixture';
import { readRegistry, setEnabled, writeRegistry } from '../../packages/plugin-store/src/registry';
import { PluginAction } from './plugin-args';
import { runPlugin } from './plugin-cli';

const MANIFEST = JSON.stringify({ id: 'acme.hello', name: 'Hello', version: '1.0.0', permissions: ['selection', 'network:api.example.com'] });

let root: string;
let said: string[];

const run = (action: Exclude<PluginAction, PluginAction.Dev>, value: string, answer = true) =>
  runPlugin({ root, say: (line) => void said.push(line), ask: async (question) => (said.push(question), answer), fetch: async () => tarball({ 'feega-plugin.json': MANIFEST, 'plugin.js': 'x' }) }, action, value);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'feega-cli-'));
  said = [];
});

describe('npx feega plugin', () => {
  it('add shows the permissions in words, asks, installs and exits 0', async () => {
    expect(await run(PluginAction.Add, 'github:acme/hello@v1.0.0')).toBe(0);
    expect(said[0]).toContain('Send requests to api.example.com');
    expect(readRegistry(root).installed['acme.hello'].version).toBe('1.0.0');
    expect(said.at(-1)).toBe('feega: installed acme.hello 1.0.0');
  });

  it('add installs nothing and exits 1 when the user says no', async () => {
    expect(await run(PluginAction.Add, 'github:acme/hello@v1.0.0', false)).toBe(1);
    expect(readRegistry(root).installed).toEqual({});
    expect(said.at(-1)).toBe('feega: not approved');
  });

  it('list shows each installed plugin with its version, source and state', async () => {
    await run(PluginAction.Add, 'github:acme/hello@v1.0.0');
    writeRegistry(root, setEnabled(readRegistry(root), 'acme.hello', false));
    said.length = 0;
    expect(await run(PluginAction.List, '')).toBe(0);
    expect(said).toEqual(['acme.hello 1.0.0  github:acme/hello@v1.0.0  off']);
  });

  it('list says when nothing is installed', async () => {
    await run(PluginAction.List, '');
    expect(said).toEqual(['feega: no plugins installed']);
  });

  it('remove deletes the plugin', async () => {
    await run(PluginAction.Add, 'github:acme/hello@v1.0.0');
    expect(await run(PluginAction.Remove, 'acme.hello')).toBe(0);
    expect(readRegistry(root).installed).toEqual({});
  });

  it('remove of an unknown plugin exits 1', async () => {
    expect(await run(PluginAction.Remove, 'nope')).toBe(1);
    expect(said).toEqual(['feega: nope is not installed']);
  });
});
