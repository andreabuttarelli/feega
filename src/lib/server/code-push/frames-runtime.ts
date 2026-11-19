import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { codeEdits } from '$lib/server/code-import/code-sync';
import { folderOf } from '$lib/server/code-import/folder-source';
import { localModeRefusal } from '$lib/server/local/local-mode';
import type { FramesDeps } from './frames-push';
import { capsOf, hostOf, type HostSources } from './hosts';
import { linkImported } from './import-link';
import type { ImportLinker } from '$lib/server/code-import/canvas-import';
import { dbLock, linkStore } from './link-store';
import { duplicateNodes } from '$lib/server/canvas/duplicate';
import type { VariantDeps } from './variants';

type Scope = { orgId: string; userId: string; projectId: string };

const localFolder = (raw: string) => (localModeRefusal(env) === null ? folderOf(raw) : null);

const sourcesOf = (db: Db, scope: Scope): HostSources => ({ connected: () => githubFor(db, scope).call(), folder: localFolder });

export const framesDeps = (db: Db, scope: Scope): FramesDeps => ({
  host: hostOf(sourcesOf(db, scope)),
  caps: capsOf(sourcesOf(db, scope)),
  edits: codeEdits,
  links: linkStore(db, scope),
  lock: dbLock(db, scope)
});

export const importLinker =
  (db: Db, scope: Scope): ImportLinker =>
  async (nodeId, origin, listed, components) => {
    if (!listed.ok) {
      return null;
    }
    const deps = framesDeps(db, scope);
    return linkImported({ host: deps.host, links: deps.links }, nodeId, origin, listed, { components, poster: null }).catch(() => null);
  };

export const variantDeps = (db: Db, scope: Scope, canvasId: string): VariantDeps => ({
  links: linkStore(db, scope),
  duplicate: async (nodeId) => (await duplicateNodes(db, { orgId: scope.orgId, projectId: scope.projectId, canvasId, nodeIds: [nodeId] })).nodes[0]?.id ?? null
});
