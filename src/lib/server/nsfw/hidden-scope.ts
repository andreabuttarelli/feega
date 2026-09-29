import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { NsfwLock } from '$lib/nsfw-access';
import { ProjectMode } from '$lib/project-mode';
import { nsfwLockFor } from './nsfw-server';

export type HiddenScope = { projectIds: string[]; canvasIds: string[]; nodeIds: string[] };

export const NOTHING_HIDDEN: HiddenScope = { projectIds: [], canvasIds: [], nodeIds: [] };

type Key = keyof HiddenScope;

const SCOPE_COLUMN_OF: Readonly<Record<string, readonly [string, Key]>> = {
  projects: ['id', 'projectIds'],
  canvases: ['project_id', 'projectIds'],
  nodes: ['project_id', 'projectIds'],
  assets: ['project_id', 'projectIds'],
  ai_calls: ['project_id', 'projectIds'],
  chat_threads: ['project_id', 'projectIds'],
  products: ['project_id', 'projectIds'],
  social_posts: ['project_id', 'projectIds'],
  nodes_connections: ['canvas_id', 'canvasIds'],
  canvas_events: ['canvas_id', 'canvasIds'],
  node_runs: ['node_id', 'nodeIds'],
  moderation_checks: ['node_id', 'nodeIds'],
  post_sources: ['node_id', 'nodeIds'],
  competitor_ads: ['node_id', 'nodeIds']
};

export function exclusionsFor(table: string, hidden: HiddenScope): Array<[string, string[]]> {
  const scope = SCOPE_COLUMN_OF[table];
  if (!scope || !hidden[scope[1]].length) {
    return [];
  }
  return [[scope[0], hidden[scope[1]]]];
}

export function touchesHidden(table: string, row: Record<string, unknown>, hidden: HiddenScope): boolean {
  return exclusionsFor(table, hidden).some(([column, ids]) => ids.includes(String(row[column] ?? '')));
}

export function inList(ids: string[]): string {
  return `(${ids.join(',')})`;
}

async function idsOf(db: Db, table: string, column: string, values: string[]): Promise<string[]> {
  if (!values.length) {
    return [];
  }
  const { data } = await (db as unknown as SupabaseClient).from(table).select('id').in(column, values);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export async function hiddenFor(db: Db, input: { orgId: string; userId: string }): Promise<HiddenScope> {
  if ((await nsfwLockFor(db, input)) === NsfwLock.Open) {
    return NOTHING_HIDDEN;
  }
  const { data } = await (db as unknown as SupabaseClient).from('projects').select('id').eq('org_id', input.orgId).eq('mode', ProjectMode.Nsfw);
  const projectIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const [canvasIds, nodeIds] = await Promise.all([idsOf(db, 'canvases', 'project_id', projectIds), idsOf(db, 'nodes', 'project_id', projectIds)]);
  return { projectIds, canvasIds, nodeIds };
}
