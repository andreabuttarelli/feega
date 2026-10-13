import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '$lib/motion/doc';
import type { BrandTokens } from '$lib/motion/brand';
import { stillSeconds } from '$lib/motion/still';
import type { StillExport } from '$lib/motion/still-model';
import { composeHtml, type ComposeInput } from '$lib/motion/hyperframes/compose';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { insertAsset } from '$lib/server/repos/assets';
import { signAssetFile, storeAssetFile } from '$lib/server/repos/asset-storage';
import { libsOrigin } from './libs-origin';
import { chromiumFrames, serverFramesOpen } from './chromium-frames';
import type { StillPort } from './server-frames';
import { assetUrls, type MotionAsset } from './editor';
import type { StillMade } from './motion-tools';

export type StillScope = { orgId: string; projectId: string; nodeId: string };

export type StillSources = { tokens: BrandTokens; assets: MotionAsset[] };

export async function drawStill(port: StillPort, compose: ComposeInput, spec: StillExport): Promise<Buffer> {
  const { doc } = compose;
  const page = await port.open({ width: doc.width, height: doc.height, scale: spec.scale });
  try {
    await page.load(composeHtml({ ...compose, origin: compose.origin ?? libsOrigin() }));
    await page.seek(stillSeconds(doc) ?? 0);
    return await page.picture(spec.mime, spec.quality);
  } finally {
    await page.close();
  }
}

export async function exportStill(db: Db, scope: StillScope, doc: MotionDoc, spec: StillExport, sources: StillSources, port: StillPort = chromiumFrames): Promise<StillMade> {
  if (!serverFramesOpen()) {
    return { ok: false, error: 'image export needs the server renderer, which is not available here' };
  }
  const bytes = await drawStill(port, { doc, tokens: sources.tokens, assets: assetUrls(sources.assets) }, spec);
  const { width, height } = spec.size(doc);
  const path = `${canvasUploadPrefix(scope.orgId, scope.projectId)}stills/${crypto.randomUUID()}.${spec.ext}`;
  await storeAssetFile(db, path, new File([new Uint8Array(bytes)], path.split('/').at(-1) as string, { type: spec.mime }));
  const row = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'image', source: 'upload', url: path, mimeType: spec.mime, bytes: bytes.length, width, height, sourceNodeId: scope.nodeId });
  return { ok: true, asset_id: row.id, url: await signAssetFile(db, path), width, height };
}
