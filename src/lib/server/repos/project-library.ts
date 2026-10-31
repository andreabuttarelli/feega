import type { Db } from '$lib/server/db/client';
import type { Json } from '$lib/database.types';
import type { LibraryEntries, LibraryKind } from '$lib/motion/project-library-ops';

const TABLE = 'project_library';
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const CONFLICT_KEY = 'project_id,kind,name';

export type LibraryScope = { orgId: string; projectId: string; kind: LibraryKind };

const rowOf = (scope: LibraryScope, name: string, value: unknown) => ({ project_id: scope.projectId, kind: scope.kind, name, value: value as Json });

function fail(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function listEntries(db: Db, scope: LibraryScope): Promise<LibraryEntries> {
  const { data, error } = await db.from(TABLE).select('name, value').eq('org_id', scope.orgId).eq('project_id', scope.projectId).eq('kind', scope.kind);
  if (error && MISSING_TABLE_CODES.has(error.code)) {
    return {};
  }
  fail(error);
  return Object.fromEntries((data ?? []).map((row) => [row.name, row.value]));
}

export async function saveEntry(db: Db, scope: LibraryScope, name: string, value: unknown): Promise<void> {
  const { error } = await db.from(TABLE).upsert({ ...rowOf(scope, name, value), org_id: scope.orgId, updated_at: new Date().toISOString() }, { onConflict: CONFLICT_KEY });
  fail(error);
}

export async function adoptEntries(db: Db, scope: LibraryScope, held: LibraryEntries, found: LibraryEntries): Promise<string[]> {
  const fresh = Object.entries(found).filter(([name]) => !(name in held));
  if (!fresh.length) {
    return [];
  }
  const { error } = await db.from(TABLE).upsert(
    fresh.map(([name, value]) => ({ ...rowOf(scope, name, value), org_id: scope.orgId })),
    { onConflict: CONFLICT_KEY, ignoreDuplicates: true }
  );
  fail(error);
  return fresh.map(([name]) => name);
}

export async function renameEntry(db: Db, scope: LibraryScope, from: string, to: string): Promise<void> {
  const { error } = await db.from(TABLE).update({ org_id: scope.orgId, name: to, updated_at: new Date().toISOString() }).eq('org_id', scope.orgId).eq('project_id', scope.projectId).eq('kind', scope.kind).eq('name', from);
  fail(error);
}

export async function removeEntry(db: Db, scope: LibraryScope, name: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('org_id', scope.orgId).eq('project_id', scope.projectId).eq('kind', scope.kind).eq('name', name);
  fail(error);
}
