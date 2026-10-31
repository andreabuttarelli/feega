import type { Db } from '$lib/server/db/client';
import { LibraryOp, type LibraryAsk, type LibraryEntries } from '$lib/motion/project-library-ops';
import { adoptEntries, listEntries, removeEntry, renameEntry, saveEntry, type LibraryScope } from '$lib/server/repos/project-library';

export type LibraryAnswer = { ok: true; entries: LibraryEntries } | { ok: false; error: string };

type Run<K extends LibraryOp> = (db: Db, scope: LibraryScope, held: LibraryEntries, ask: Extract<LibraryAsk, { op: K }>) => Promise<string | null>;

const RUN: { [K in LibraryOp]: Run<K> } = {
  [LibraryOp.Save]: async (db, scope, _, ask) => (await saveEntry(db, scope, ask.name, ask.value), null),
  [LibraryOp.Rename]: async (db, scope, held, ask) => {
    if (!(ask.name in held)) {
      return `no project ${scope.kind} ${ask.name}`;
    }
    if (ask.to in held) {
      return `a project ${scope.kind} ${ask.to} already exists`;
    }
    await renameEntry(db, scope, ask.name, ask.to);
    return null;
  },
  [LibraryOp.Remove]: async (db, scope, held, ask) => (ask.name in held ? (await removeEntry(db, scope, ask.name), null) : `no project ${scope.kind} ${ask.name}`),
  [LibraryOp.Adopt]: async (db, scope, held, ask) => (await adoptEntries(db, scope, held, ask.entries), null)
};

export async function runLibrary(db: Db, scope: LibraryScope, ask: LibraryAsk): Promise<LibraryAnswer> {
  const held = await listEntries(db, scope);
  const refused = await (RUN[ask.op] as Run<LibraryOp>)(db, scope, held, ask as never);
  return refused ? { ok: false, error: refused } : { ok: true, entries: await listEntries(db, scope) };
}
