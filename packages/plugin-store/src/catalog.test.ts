import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Origin } from '@feega/plugin-api/external';
import { catalogOf } from './catalog';
import { readRegistry, setEnabled, writeRegistry } from './registry';
import { permissionsOf } from './bundle';
import { parseManifest } from '@feega/plugin-api/manifest';

const manifest = (over: object = {}) => ({ id: 'acme.hello', name: 'Hello', version: '1.0.0', permissions: ['selection'], contributions: { command: [{ id: 'go', title: 'Go' }] }, ...over });

function folder(parent: string, name: string, files: Record<string, string>) {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  return dir;
}

let root: string;
let work: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'feega-cat-root-'));
  work = mkdtempSync(join(tmpdir(), 'feega-cat-work-'));
});

function installed(over: object = {}, code = 'self.a = 1;') {
  const m = manifest(over) as { id: string; version: string };
  folder(root, `${m.id}/${m.version}`, { 'feega-plugin.json': JSON.stringify(m), 'plugin.js': code });
  const parsed = parseManifest(m);
  writeRegistry(root, { ...readRegistry(root), installed: { [m.id]: { version: m.version, source: 'github:acme/hello', sha256: 'f', permissions: parsed.ok ? permissionsOf(parsed.manifest) : [] } } });
}

describe('catalogOf', () => {
  it('lists an installed plugin with its code and permissions in words', async () => {
    installed();
    const out = await catalogOf({ root, dev: [] });
    expect(out.problems).toEqual([]);
    expect(out.plugins).toMatchObject([{ id: 'acme.hello', origin: Origin.Installed, enabled: true, code: 'self.a = 1;', words: ['See which element you select'] }]);
  });

  it('lists a dev folder marked as dev, reading the entry named by main', async () => {
    const dir = folder(work, 'mine', { 'feega-plugin.json': JSON.stringify({ ...manifest({ id: 'me.dev' }), main: 'dist/index.js' }), 'dist/index.js': 'self.b = 2;' });
    const out = await catalogOf({ root, dev: [dir] });
    expect(out.plugins).toMatchObject([{ id: 'me.dev', origin: Origin.Dev, code: 'self.b = 2;' }]);
  });

  it('reports a dev folder that cannot load instead of failing', async () => {
    const dir = folder(work, 'broken', { 'feega-plugin.json': '{nope' });
    const out = await catalogOf({ root, dev: [dir, join(work, 'missing')] });
    expect(out.plugins).toEqual([]);
    expect(out.problems).toHaveLength(2);
    expect(out.problems[0]).toContain(dir);
  });

  it('reflects the switches in the registry, for built-ins too', async () => {
    installed();
    writeRegistry(root, setEnabled(setEnabled(readRegistry(root), 'acme.hello', false), 'feega.mesh-gradient', false));
    const out = await catalogOf({ root, dev: [] });
    expect(out.plugins[0].enabled).toBe(false);
    expect(out.disabled).toEqual(['acme.hello', 'feega.mesh-gradient']);
  });

  it('prefers the dev folder over the installed copy of the same plugin', async () => {
    installed();
    const dir = folder(work, 'mine', { 'feega-plugin.json': JSON.stringify(manifest({ version: '9.9.9' })), 'plugin.js': 'self.c = 3;' });
    const out = await catalogOf({ root, dev: [dir] });
    expect(out.plugins).toMatchObject([{ id: 'acme.hello', origin: Origin.Dev, version: '9.9.9' }]);
  });

  it('refuses an installed plugin whose files now ask for more than was approved', async () => {
    installed();
    folder(root, 'acme.hello/1.0.0', { 'feega-plugin.json': JSON.stringify(manifest({ permissions: ['selection', 'edit.insert'] })) });
    const out = await catalogOf({ root, dev: [] });
    expect(out.plugins).toEqual([]);
    expect(out.problems[0]).toMatch(/permissions/);
  });
});
