import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { findNode } from '$lib/server/repos/canvas';
import { insertAsset } from '$lib/server/repos/assets';
import { SIGNED_URL_TTL_S, signAssetFile, storeAssetFile } from '$lib/server/repos/asset-storage';
import { frameStore } from './move-element';
import { chromiumExport } from './chromium-frames';
import { drawTargets } from './selection-draw';
import { libsOrigin } from './libs-origin';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { assetUrls, motionAssets, motionTokens } from './editor';
import type { DrawTarget, SelectionPorts } from './selection-export';

export type SelectionScope = { db: Db; orgId: string; projectId: string; brandId: string | null; actor: Actor };

const FRAME_NAME = 'Frame';

export function selectionPorts(scope: SelectionScope): SelectionPorts {
  const { db, orgId, projectId } = scope;
  const frames = frameStore(db, { orgId, actor: scope.actor, projectId });
  const tokens = motionTokens(db, { orgId, brandId: scope.brandId });
  const canvasOf = new Map<string, string>();

  const compose = async (target: DrawTarget) => {
    const assets = await motionAssets({ db, orgId, projectId, canvasId: canvasOf.get(target.nodeId)! }, SIGNED_URL_TTL_S.render);
    return composeHtml({ doc: target.doc, tokens: await tokens, assets: assetUrls(assets), origin: libsOrigin() });
  };

  return {
    read: async (nodeId) => {
      const [frame, node] = await Promise.all([frames.read(nodeId), findNode(db, { orgId, nodeId })]);
      if (!frame) {
        return null;
      }
      canvasOf.set(nodeId, frame.canvasId);
      return { name: node?.displayName || FRAME_NAME, doc: frame.doc };
    },
    draw: (targets, row) => drawTargets(chromiumExport, compose, targets, row),
    store: async (packed) => {
      const path = `${canvasUploadPrefix(orgId, projectId)}exports/${crypto.randomUUID()}/${packed.name}`;
      await storeAssetFile(db, path, new File([new Uint8Array(packed.bytes)], packed.name, { type: packed.mime }));
      const row = await insertAsset(db, { orgId, projectId, type: packed.mime.startsWith('image/') ? 'image' : 'document', source: 'upload', url: path, mimeType: packed.mime, bytes: packed.bytes.length });
      return { asset_id: row.id, url: await signAssetFile(db, path) };
    }
  };
}
