import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { listMemberships } from '$lib/server/repos/orgs';
import { activeSince, type PluginTier } from '$lib/plugins/listing';

export type CatalogueRow = {
  id: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latestVersion: string;
  manifest: Record<string, unknown>;
  installs: number;
  activeInstalls: number;
  upvotes: number;
};

export type Mine = {
  installed: Record<string, { enabled: boolean }>;
  voted: string[];
};

export type PluginStore = {
  catalogue(id?: string): Promise<CatalogueRow[]>;
  mine(userId: string): Promise<Mine>;
  orgOf(userId: string): Promise<string | null>;
  install(input: { userId: string; orgId: string; pluginId: string }): Promise<void>;
  uninstall(userId: string, pluginId: string): Promise<void>;
  setEnabled(userId: string, pluginId: string, enabled: boolean): Promise<boolean>;
  vote(userId: string, pluginId: string): Promise<void>;
  unvote(userId: string, pluginId: string): Promise<void>;
  heartbeat(userId: string, pluginIds: string[]): Promise<void>;
};

type CatalogueRecord = {
  id: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latest_version: string;
  manifest: Record<string, unknown>;
  installs: number;
  active_installs: number;
  upvotes: number;
};

type InstallRecord = { plugin_id: string; enabled: boolean };
type VoteRecord = { plugin_id: string };

function loose(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as T;
}

function fail(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function toRow(record: CatalogueRecord): CatalogueRow {
  return {
    id: record.id,
    name: record.name,
    summary: record.summary,
    author: record.author,
    tier: record.tier,
    latestVersion: record.latest_version,
    manifest: record.manifest,
    installs: Number(record.installs),
    activeInstalls: Number(record.active_installs),
    upvotes: Number(record.upvotes)
  };
}

export function supabasePluginStore(db: Db, now: () => Date = () => new Date()): PluginStore {
  const client = loose(db);

  return {
    async catalogue(id) {
      const result = await client.rpc('plugin_catalogue', { p_id: id ?? null, p_active_since: activeSince(now()).toISOString() });

      return must<CatalogueRecord[]>(result).map(toRow);
    },

    async mine(userId) {
      const installs = await client.from('plugin_installs').select('plugin_id, enabled').eq('user_id', userId).is('uninstalled_at', null);
      const votes = await client.from('plugin_votes').select('plugin_id').eq('user_id', userId);

      return {
        installed: Object.fromEntries(must<InstallRecord[]>(installs).map((r) => [r.plugin_id, { enabled: r.enabled }])),
        voted: must<VoteRecord[]>(votes).map((r) => r.plugin_id)
      };
    },

    async orgOf(userId) {
      const [first] = await listMemberships(db, userId);

      return first?.org.id ?? null;
    },

    async install({ userId, orgId, pluginId }) {
      const stamp = now().toISOString();
      const { error } = await client.from('plugin_installs').upsert(
        {
          plugin_id: pluginId,
          user_id: userId,
          org_id: orgId,
          installed_at: stamp,
          uninstalled_at: null,
          enabled: true,
          last_seen_at: stamp
        },
        { onConflict: 'plugin_id,user_id' }
      );

      fail(error);
    },

    async uninstall(userId, pluginId) {
      const { error } = await client
        .from('plugin_installs')
        .update({ uninstalled_at: now().toISOString() })
        .eq('user_id', userId)
        .eq('plugin_id', pluginId)
        .is('uninstalled_at', null);

      fail(error);
    },

    async setEnabled(userId, pluginId, enabled) {
      const { data, error } = await client
        .from('plugin_installs')
        .update({ enabled })
        .eq('user_id', userId)
        .eq('plugin_id', pluginId)
        .is('uninstalled_at', null)
        .select('plugin_id');

      fail(error);

      return (data ?? []).length > 0;
    },

    async vote(userId, pluginId) {
      const { error } = await client.from('plugin_votes').upsert({ plugin_id: pluginId, user_id: userId }, { onConflict: 'plugin_id,user_id', ignoreDuplicates: true });

      fail(error);
    },

    async unvote(userId, pluginId) {
      const { error } = await client.from('plugin_votes').delete().eq('user_id', userId).eq('plugin_id', pluginId);

      fail(error);
    },

    async heartbeat(userId, pluginIds) {
      const { error } = await client
        .from('plugin_installs')
        .update({ last_seen_at: now().toISOString() })
        .eq('user_id', userId)
        .in('plugin_id', pluginIds)
        .is('uninstalled_at', null);

      fail(error);
    }
  };
}
