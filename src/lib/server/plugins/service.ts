import { isPluginId, type PluginListing } from '$lib/plugins/listing';
import type { CatalogueRow, PluginStore } from './store';

export type Entitled = (orgId: string) => Promise<boolean>;

export type PluginError = 'not_found' | 'not_installed' | 'plugin_locked';

export type Outcome = { ok: true } | { ok: false; error: PluginError };

const OK: Outcome = { ok: true };
const NOT_FOUND: Outcome = { ok: false, error: 'not_found' };

export function createPluginService(store: PluginStore, entitled: Entitled) {
  async function viewerOrg(userId: string | null): Promise<string | null> {
    return userId ? store.orgOf(userId) : null;
  }

  async function isLocked(row: CatalogueRow, orgId: string | null): Promise<boolean> {
    if (row.tier === 'free') {
      return false;
    }

    return orgId === null || !(await entitled(orgId));
  }

  async function listing(rows: CatalogueRow[], userId: string | null): Promise<PluginListing[]> {
    const mine = userId ? await store.mine(userId) : { installed: {}, voted: [] };
    const orgId = await viewerOrg(userId);

    return Promise.all(
      rows.map(async (row) => {
        const install = mine.installed[row.id];

        return {
          ...row,
          installedByMe: Boolean(install),
          enabledByMe: install?.enabled ?? false,
          votedByMe: mine.voted.includes(row.id),
          locked: await isLocked(row, orgId)
        };
      })
    );
  }

  async function known(id: string): Promise<CatalogueRow | null> {
    if (!isPluginId(id)) {
      return null;
    }

    const [row] = await store.catalogue(id);

    return row ?? null;
  }

  return {
    list: async (userId: string | null) => listing(await store.catalogue(), userId),

    async get(userId: string | null, id: string): Promise<PluginListing | null> {
      const row = await known(id);

      return row ? (await listing([row], userId))[0] : null;
    },

    async install(userId: string, id: string): Promise<Outcome> {
      const row = await known(id);
      if (!row) {
        return NOT_FOUND;
      }

      const orgId = await store.orgOf(userId);
      if (!orgId || (await isLocked(row, orgId))) {
        return { ok: false, error: 'plugin_locked' };
      }

      await store.install({ userId, orgId, pluginId: id });

      return OK;
    },

    async uninstall(userId: string, id: string): Promise<Outcome> {
      if (!isPluginId(id)) {
        return NOT_FOUND;
      }

      await store.uninstall(userId, id);

      return OK;
    },

    async setEnabled(userId: string, id: string, enabled: boolean): Promise<Outcome> {
      if (!isPluginId(id)) {
        return NOT_FOUND;
      }

      const changed = await store.setEnabled(userId, id, enabled);

      return changed ? OK : { ok: false, error: 'not_installed' };
    },

    async vote(userId: string, id: string): Promise<Outcome> {
      if (!(await known(id))) {
        return NOT_FOUND;
      }

      await store.vote(userId, id);

      return OK;
    },

    async unvote(userId: string, id: string): Promise<Outcome> {
      if (!isPluginId(id)) {
        return NOT_FOUND;
      }

      await store.unvote(userId, id);

      return OK;
    },

    async heartbeat(userId: string, pluginIds: string[]): Promise<void> {
      const ids = [...new Set(pluginIds.filter(isPluginId))];
      if (!ids.length) {
        return;
      }

      await store.heartbeat(userId, ids);
    }
  };
}

export type PluginService = ReturnType<typeof createPluginService>;
