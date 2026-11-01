import type { LibraryAsk, LibraryEntries, LibraryKind } from '$lib/motion/project-library-ops';

export type LibraryStore = {
  load: () => Promise<LibraryEntries>;
  send: (ask: LibraryAsk) => Promise<boolean>;
};

const pathOf = (projectId: string, kind: LibraryKind) => `/api/v1/projects/${encodeURIComponent(projectId)}/library/${kind}`;

export function projectLibraryStore(projectId: string, kind: LibraryKind): LibraryStore {
  const path = pathOf(projectId, kind);
  return {
    load: async () => {
      const res = await fetch(path).catch(() => null);
      return res?.ok ? ((await res.json()) as { entries: LibraryEntries }).entries : {};
    },
    send: async (ask) => {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ask) }).catch(() => null);
      return !!res?.ok;
    }
  };
}
