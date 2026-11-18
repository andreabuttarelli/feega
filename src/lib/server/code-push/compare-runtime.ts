import { env } from '$env/dynamic/private';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { Db } from '$lib/server/db/client';
import { importCodeInto, type CodeScope } from '$lib/server/code-import/canvas-import';
import { CodeImportOutcome } from '$lib/server/code-import/import-code';
import { folderOf } from '$lib/server/code-import/folder-source';
import { localModeRefusal } from '$lib/server/local/local-mode';
import { frameStore, type NodeShape } from '$lib/server/motion/move-element';
import { DataCheck, deleteNode, findNode, patchNodeData, renameNode } from '$lib/server/repos/canvas';
import { versionMarkOf } from '$lib/canvas/version-frame';
import type { CompareDeps, ImportAtAsk } from './frames-compare';
import type { ActionDeps } from './frames-version-actions';
import { framesDeps } from './frames-runtime';
import { CodeSourceKind } from './link';
import { checkoutAt } from './version-checkout';

export const VERSION_SUMMARY = 'Locked as a read-only version';

const lockedAs = (doc: MotionDoc, locked: boolean): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, locked })) });

export const readOnlyDoc = (doc: MotionDoc): MotionDoc => lockedAs(doc, true);

const VARIANT_GAP = 80;
const VERSION_KEY = 'version';
const VARIANT_SUFFIX = ' variant';

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
      const done = await importCodeInto(scope, ask.canvasId, { ...source, app: ask.link.appRoot || undefined, routes: [ask.link.route ?? '/'], at: ask.centre });
      return done.outcome === CodeImportOutcome.Ok ? { frameId: done.frameId } : { error: done.error ?? done.outcome };
    },
    markOf: async (nodeId) => versionMarkOf((await findNode(db, { orgId: scope.orgId, nodeId }))?.data),
    remove: (nodeId) => deleteNode(db, { orgId: scope.orgId, nodeId, actor: scope.actor }),
    mark: async (frameId, mark) => {
      await patchNodeData(db, { orgId: scope.orgId, nodeId: frameId, patch: { [VERSION_KEY]: mark }, check: DataCheck.None, actor: scope.actor });
      await renameNode(db, { orgId: scope.orgId, nodeId: frameId, name: mark.label });
      const head = await store.read(frameId);
      if (head) {
        await store.write(frameId, head.version, readOnlyDoc(head.doc), VERSION_SUMMARY);
      }
    }
  };
}

export function actionDeps(db: Db, scope: CodeScope): ActionDeps {
  const frames = framesDeps(db, scope);
  const store = frameStore(db, scope);

  return {
    host: frames.host,
    links: frames.links,
    markOf: async (nodeId) => versionMarkOf((await findNode(db, { orgId: scope.orgId, nodeId }))?.data),
    copyAsVariant: async (versionId) => {
      const [head, node] = await Promise.all([store.read(versionId), findNode(db, { orgId: scope.orgId, nodeId: versionId })]);
      if (!head || !node) {
        return null;
      }
      const data = Object.fromEntries(Object.entries(node.data).filter(([key]) => key !== VERSION_KEY));
      const shape = { type: node.type, data, width: node.size.width ?? 0, height: node.size.height ?? 0, displayName: `${node.displayName ?? ''}${VARIANT_SUFFIX}` } as NodeShape;
      return store.create({ projectId: scope.projectId, canvasId: node.canvasId, x: node.position.x, y: node.position.y + (node.size.height ?? 0) + VARIANT_GAP }, lockedAs(head.doc, false), shape);
    }
  };
}
