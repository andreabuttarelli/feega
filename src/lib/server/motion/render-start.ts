import type { Db } from '$lib/server/db/client';
import { SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { clipsOf, type MotionDoc } from '$lib/motion/doc';
import type { RenderSettings } from '$lib/motion/export-formats';
import { assetUrls, motionAssets, motionTokens } from './editor';
import { analyzeSounds, storageAnalysis } from './audio-analysis';
import { motionRenderFarm, motionRenderStorage } from './renderer';
import { renderRequest, startRender, type RenderStart } from './render-run';

export type FarmStart = { orgId: string; projectId: string; canvasId: string; nodeId: string; userId: string; brandId: string | null; editorUrl: string; head: { version: number; doc: MotionDoc }; settings: RenderSettings };

export async function startFarmRender(db: Db, input: FarmStart): Promise<RenderStart> {
  const [assets, tokens] = await Promise.all([
    motionAssets({ db, orgId: input.orgId, projectId: input.projectId, canvasId: input.canvasId }, SIGNED_URL_TTL_S.render),
    motionTokens(db, { orgId: input.orgId, brandId: input.brandId })
  ]);
  const soundIds = clipsOf(input.head.doc).map((c) => String(c.props.assetId ?? ''));
  const analyses = await analyzeSounds(storageAnalysis(db), { orgId: input.orgId, projectId: input.projectId }, assets, soundIds);
  const req = renderRequest(input.head.version, { doc: input.head.doc, tokens, assets: assetUrls(assets), analyses }, input.settings);

  const renderScope = { orgId: input.orgId, nodeId: input.nodeId, projectId: input.projectId, userId: input.userId, editorUrl: input.editorUrl };
  return startRender(db, motionRenderFarm(), renderScope, req, motionRenderStorage());
}
