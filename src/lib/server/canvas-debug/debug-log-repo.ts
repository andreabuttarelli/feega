import { appendFile } from 'node:fs/promises';
import type { Json } from '$lib/database.types';
import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { LOCAL_FILE_ENV } from '$lib/server/local/local-mode';

export type DebugRow = { session: string; seq: number; t_ms: number; user_id: string; org_id: string | null; canvas_id: string | null; kind: string; props: Json };

type Env = Record<string, string | undefined>;

const DEBUG_FILE_SUFFIX = '.debug.jsonl';

const DEBUG_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/canvas-debug/debug-log-repo.ts'));

export async function canvasOrgOf(db: Db, canvasId: string): Promise<string | null> {
  const { data } = await db.from('canvases').select('org_id').eq('id', canvasId).is('deleted_at', null).maybeSingle();
  return data?.org_id ?? null;
}

async function intoFile(path: string, rows: DebugRow[]): Promise<void> {
  const at = new Date().toISOString();
  await appendFile(`${path}${DEBUG_FILE_SUFFIX}`, rows.map((r) => `${JSON.stringify({ created_at: at, ...r })}\n`).join(''));
}

export async function writeDebugRows(rows: DebugRow[], env: Env = process.env): Promise<void> {
  const localFile = env[LOCAL_FILE_ENV];
  if (localFile) {
    await intoFile(localFile, rows);
    return;
  }
  if (!DEBUG_USE) {
    throw new Error('canvas_debug_logs service role use not declared');
  }

  const { error } = await createServiceRoleDb(DEBUG_USE).from('canvas_debug_logs').insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}
