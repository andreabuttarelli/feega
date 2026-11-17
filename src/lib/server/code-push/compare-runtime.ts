import { env } from '$env/dynamic/private';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { Db } from '$lib/server/db/client';
import { importCodeInto, type CodeScope } from '$lib/server/code-import/canvas-import';
import { CodeImportOutcome } from '$lib/server/code-import/import-code';
import { folderOf } from '$lib/server/code-import/folder-source';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { frameStore } from '$lib/server/motion/move-element';
import { DataCheck, findNode, patchNodeData, renameNode } from '$lib/server/repos/canvas';
import type { CompareDeps, ImportAtAsk } from './frames-compare';
import { framesDeps } from './frames-runtime';
import { CodeSourceKind } from './link';
import { checkoutAt } from './version-checkout';

export const VERSION_SUMMARY = 'Locked as a read-only version';

export const readOnlyDoc = (doc: MotionDoc): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, locked: true })) });

const localFolder = (raw: string) => (localModeRefusal(env) === null ? folderOf(raw) : null);

type SourceAt = (ask: ImportAtAsk) => Promise<{ repo: string } | { folder: string } | null>;

const SOURCE_AT: Record<CodeSourceKind, SourceAt> = {
  [CodeSourceKind.Github]: async (ask) => ({ repo: `https://github.com/${ask.link.repo}/tree/${ask.sha}` }),
  [CodeSourceKind.Folder]: async (ask) => {
    const root = localFolder(ask.link.repo);
    return root ? { folder: await checkoutAt(root, ask.sha) } : null;
  }
};

export function compareDeps(db: Db, scope: CodeScope): CompareDeps {
  const frames = framesDeps(db, scope);
  const store = frameStore(db, scope);

  return {
    host: frames.host,
    links: frames.links,
    placeOf: async (nodeId) => {
      const node = await findNode(db, { orgId: scope.orgId, nodeId });
      return node ? { canvasId: node.canvasId, x: node.position.x, y: node.position.y, w: node.size.width ?? 0, h: node.size.height ?? 0 } : null;
    },
    importAt: async (ask) => {
      const source = await SOURCE_AT[ask.link.source](ask);
      if (!source) {
        return { error: 'source_unavailable' };
      }
      const done = await importCodeInto(scope, ask.canvasId, { ...source, app: ask.link.appRoot || undefined, routes: [ask.link.route ?? '/'], at: ask.at });
      return done.outcome === CodeImportOutcome.Ok ? { frameId: done.frameId } : { error: done.error ?? done.outcome };
    },
    mark: async (frameId, mark) => {
      await patchNodeData(db, { orgId: scope.orgId, nodeId: frameId, patch: { version: mark }, check: DataCheck.None, actor: scope.actor });
      await renameNode(db, { orgId: scope.orgId, nodeId: frameId, name: mark.label });
      const head = await store.read(frameId);
      if (head) {
        await store.write(frameId, head.version, readOnlyDoc(head.doc), VERSION_SUMMARY);
      }
    }
  };
}
