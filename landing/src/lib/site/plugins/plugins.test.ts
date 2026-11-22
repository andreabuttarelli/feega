import { describe, expect, it } from 'vitest';
import { FALLBACK_PLUGINS } from './fallback';
import { loadPlugins, pluginPath } from './catalogue';
import { permissionWords } from './permissions';

const apiRow = {
  id: 'mesh-gradient',
  name: 'Mesh gradient',
  summary: 'From the API',
  author: 'Feega',
  tier: 'free',
  latestVersion: '1.0.0',
  manifest: { permissions: ['selection'] },
  installs: 12,
  activeInstalls: 7,
  upvotes: 3
};

const answering = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
const failing = (async () => {
  throw new Error('offline');
}) as unknown as typeof fetch;

describe('permission words', () => {
  it('explains each known permission in plain words', () => {
    expect(permissionWords('selection')).toBe('See which element you have selected');
    expect(permissionWords('edit.dependency')).toBe('Add packages to your package.json');
  });

  it('names the host of a network permission', () => {
    expect(permissionWords('network:cdn.jsdelivr.net')).toBe('Download files from cdn.jsdelivr.net');
  });

  it('never hides an unknown permission', () => {
    expect(permissionWords('teleport')).toBe('Ask for the permission "teleport"');
  });
});

describe('loadPlugins', () => {
  it('shows the live counts from the public api', async () => {
    const plugins = await loadPlugins(answering({ plugins: [apiRow] }));

    expect(plugins[0]).toMatchObject({ id: 'mesh-gradient', summary: 'From the API', stats: { installs: 12, activeInstalls: 7, upvotes: 3 } });
  });

  it('keeps the long description and permissions of the page', async () => {
    const [plugin] = await loadPlugins(answering({ plugins: [apiRow] }));

    expect(plugin.permissions).toEqual(['See which element you have selected']);
    expect(plugin.description.length).toBeGreaterThan(plugin.summary.length);
  });

  it('falls back to the built-ins without counts when the api is down', async () => {
    const plugins = await loadPlugins(failing);

    expect(plugins.map((p) => p.id)).toEqual(FALLBACK_PLUGINS.map((p) => p.id));
    expect(plugins.every((p) => p.stats === null)).toBe(true);
  });

  it('falls back when the api answers an error', async () => {
    const plugins = await loadPlugins(answering({}, false));

    expect(plugins.length).toBe(FALLBACK_PLUGINS.length);
  });

  it('falls back when the catalogue is empty or malformed', async () => {
    expect((await loadPlugins(answering({ plugins: [] }))).length).toBe(FALLBACK_PLUGINS.length);
    expect((await loadPlugins(answering({ nope: 1 }))).length).toBe(FALLBACK_PLUGINS.length);
  });

  it('builds the detail path from the id', () => {
    expect(pluginPath('3d-object')).toBe('/plugins/3d-object');
  });
});
