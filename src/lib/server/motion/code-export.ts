import { json } from '@sveltejs/kit';
import { CODE_TARGETS, CodeTarget, codeAssetIds, exportCode, type CodeExport } from '@feega/motion-core/motion/codegen/index';
import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { motionOf } from '$lib/canvas/motion-node';
import { assetsById, headOrNew, motionTokens, type AssetSigner } from './editor';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const FALLBACK_NAME = 'Frame';

export const isCodeTarget = (value: string): value is CodeTarget => (CODE_TARGETS as readonly string[]).includes(value);

export type FrameCode = CodeExport & { name: string };

export async function frameCode(db: Db, input: { orgId: string; nodeId: string; target: string; sign?: AssetSigner }): Promise<FrameCode | Response> {
  if (!isCodeTarget(input.target)) {
    return json({ error: 'unknown_target', targets: CODE_TARGETS }, { status: HTTP_BAD_REQUEST });
  }
  const record = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  const node = record ? motionOf(record) : null;
  if (!record || !node) {
    return json({ error: 'motion_node_not_found' }, { status: HTTP_NOT_FOUND });
  }

  const [head, project] = await Promise.all([headOrNew(db, { orgId: input.orgId, nodeId: record.id }, node), findProjectById(db, { orgId: input.orgId, projectId: record.projectId })]);
  const scope = { db, orgId: input.orgId, projectId: record.projectId, canvasId: record.canvasId, sign: input.sign };
  const [brand, assets] = await Promise.all([motionTokens(db, { orgId: input.orgId, brandId: project?.brandId ?? null }), assetsById(scope, codeAssetIds(head.doc))]);

  const name = record.displayName?.trim() || FALLBACK_NAME;
  return { name, ...exportCode(head.doc, { target: input.target, name, assets, brand }) };
}
