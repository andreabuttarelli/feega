import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/effects';
import { findLayout, listLayouts, patchLayout, writeLayout, type LayoutWritten, type StoredLayout } from '$lib/server/repos/layouts';

export type LayoutStore = {
  write: (input: { name: string; spec: unknown }) => Promise<LayoutWritten>;
  patch: (input: { layoutId: string; version: number; spec: unknown }) => Promise<LayoutWritten>;
  list: () => Promise<StoredLayout[] | null>;
  find: (id: string) => Promise<StoredLayout | null>;
};

export function layoutStore(scope: { db: Db; orgId: string; actor: Actor }): LayoutStore {
  const { db, orgId, actor } = scope;
  return {
    write: (input) => writeLayout(db, orgId, actor, input),
    patch: (input) => patchLayout(db, orgId, input.layoutId, { version: input.version, spec: input.spec }),
    list: () => listLayouts(db, orgId),
    find: (id) => findLayout(db, orgId, id)
  };
}
