import { describe, expect, it } from 'vitest';
import { createPluginService } from './service';
import type { CatalogueRow, PluginStore, Mine } from './store';

const ORG = 'org-1';

function row(over: Partial<CatalogueRow> = {}): CatalogueRow {
  return {
    id: 'mesh-gradient',
    name: 'Mesh gradient',
    summary: 'Edit mesh gradients',
    author: 'Feega',
    tier: 'free',
    latestVersion: '1.0.0',
    manifest: {},
    installs: 3,
    activeInstalls: 2,
    upvotes: 5,
    ...over
  };
}

function fakeStore(rows: CatalogueRow[], mine: Mine = { installed: {}, voted: [] }) {
  const calls: string[] = [];
  const store: PluginStore = {
    catalogue: async (id) => rows.filter((r) => !id || r.id === id),
    mine: async () => mine,
    orgOf: async () => ORG,
    install: async (input) => {
      calls.push(`install:${input.pluginId}:${input.orgId}`);
    },
    uninstall: async (_u, id) => {
      calls.push(`uninstall:${id}`);
    },
    setEnabled: async (_u, id, enabled) => {
      calls.push(`enabled:${id}:${enabled}`);
      return id in mine.installed;
    },
    vote: async (_u, id) => {
      calls.push(`vote:${id}`);
    },
    unvote: async (_u, id) => {
      calls.push(`unvote:${id}`);
    },
    heartbeat: async (_u, ids) => {
      calls.push(`heartbeat:${ids.join(',')}`);
    }
  };
  return { store, calls };
}

const entitled = async () => true;
const notEntitled = async () => false;

describe('catalogue', () => {
  it('lists counts, tier and my flags for a signed-in user', async () => {
    const { store } = fakeStore([row()], { installed: { 'mesh-gradient': { enabled: true } }, voted: ['mesh-gradient'] });
    const service = createPluginService(store, entitled);

    const [plugin] = await service.list('u1');

    expect(plugin).toMatchObject({
      id: 'mesh-gradient',
      installs: 3,
      activeInstalls: 2,
      upvotes: 5,
      tier: 'free',
      installedByMe: true,
      enabledByMe: true,
      votedByMe: true,
      locked: false
    });
  });

  it('shows no personal flags to an anonymous visitor', async () => {
    const { store } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    const [plugin] = await service.list(null);

    expect(plugin).toMatchObject({ installedByMe: false, votedByMe: false, locked: false });
  });

  it('locks a pro plugin when the org is not entitled', async () => {
    const { store } = fakeStore([row({ tier: 'pro' })]);
    const service = createPluginService(store, notEntitled);

    const [plugin] = await service.list('u1');

    expect(plugin.locked).toBe(true);
  });

  it('locks a pro plugin for an anonymous visitor', async () => {
    const { store } = fakeStore([row({ tier: 'pro' })]);
    const service = createPluginService(store, entitled);

    const [plugin] = await service.list(null);

    expect(plugin.locked).toBe(true);
  });

  it('answers null for an unknown plugin', async () => {
    const { store } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    expect(await service.get('u1', 'nope')).toBeNull();
  });
});

describe('install', () => {
  it('installs into the caller org', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    const result = await service.install('u1', 'mesh-gradient');

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(['install:mesh-gradient:org-1']);
  });

  it('refuses a locked plugin', async () => {
    const { store, calls } = fakeStore([row({ tier: 'pro' })]);
    const service = createPluginService(store, notEntitled);

    const result = await service.install('u1', 'mesh-gradient');

    expect(result).toEqual({ ok: false, error: 'plugin_locked' });
    expect(calls).toEqual([]);
  });

  it('refuses an unknown plugin', async () => {
    const { store } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    expect(await service.install('u1', 'nope')).toEqual({ ok: false, error: 'not_found' });
  });

  it('refuses a malformed id before touching the store', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    expect(await service.install('u1', 'Bad Id!')).toEqual({ ok: false, error: 'not_found' });
    expect(calls).toEqual([]);
  });
});

describe('enable, uninstall, vote', () => {
  it('toggles enabled on an installed plugin', async () => {
    const { store, calls } = fakeStore([row()], { installed: { 'mesh-gradient': { enabled: true } }, voted: [] });
    const service = createPluginService(store, entitled);

    expect(await service.setEnabled('u1', 'mesh-gradient', false)).toEqual({ ok: true });
    expect(calls).toEqual(['enabled:mesh-gradient:false']);
  });

  it('answers not_installed when toggling a plugin that was never installed', async () => {
    const { store } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    expect(await service.setEnabled('u1', 'mesh-gradient', true)).toEqual({ ok: false, error: 'not_installed' });
  });

  it('uninstalls', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    await service.uninstall('u1', 'mesh-gradient');

    expect(calls).toEqual(['uninstall:mesh-gradient']);
  });

  it('votes and unvotes', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    await service.vote('u1', 'mesh-gradient');
    await service.unvote('u1', 'mesh-gradient');

    expect(calls).toEqual(['vote:mesh-gradient', 'unvote:mesh-gradient']);
  });

  it('refuses to vote on an unknown plugin', async () => {
    const { store } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    expect(await service.vote('u1', 'nope')).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('heartbeat', () => {
  it('records the valid ids once, deduplicated', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    await service.heartbeat('u1', ['mesh-gradient', 'mesh-gradient', 'Bad Id!']);

    expect(calls).toEqual(['heartbeat:mesh-gradient']);
  });

  it('does nothing for an empty list', async () => {
    const { store, calls } = fakeStore([row()]);
    const service = createPluginService(store, entitled);

    await service.heartbeat('u1', []);

    expect(calls).toEqual([]);
  });
});
