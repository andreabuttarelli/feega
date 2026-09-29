import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { listMemberships } from '$lib/server/repos/orgs';
import { findAsset } from '$lib/server/repos/assets';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import type { ThumbnailPreset } from '$lib/server/media-thumbnails';
import { AssetSize, sizeOf } from '$lib/canvas/asset-url';

const IMAGE_PRESET_OF: Record<AssetSize, ThumbnailPreset | undefined> = {
  [AssetSize.Thumb]: 'nodeThumbnail',
  [AssetSize.Px256]: 'canvas256',
  [AssetSize.Px512]: 'canvas512',
  [AssetSize.Px1024]: 'canvas1024',
  [AssetSize.Px2048]: 'canvas2048',
  [AssetSize.Full]: undefined
};

/**
 * UN ASSET DI UNA TELA, CON LA FIRMA DEL MOMENTO.
 *
 * `/c/<canvasId>/assets/<id>`: l'id da solo non basta, perché la tela va aperta per sapere che è
 * tua — e un asset senza la sua tela sarebbe un file di chiunque. La firma non si conserva: dura
 * due ore, e una tela lasciata aperta tutto il giorno mostrerebbe riquadri rotti.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findCanvasForUser(db, { canvasId: params.canvasId ?? '', memberships });
  if (!found) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }

  const asset = await findAsset(db, { orgId: found.orgId, assetId: params.id ?? '' });
  if (!asset) {
    throw error(404, 'Asset not found');
  }

  if (asset.type === 'text' && asset.content !== null) {
    return new Response(asset.content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  const path = asset.url ?? '';
  if (!path) {
    throw error(404, 'asset senza file');
  }

  if (asset.source === 'imported' && /^https?:\/\//.test(path)) {
    return new Response(null, { status: 302, headers: { Location: path, 'Cache-Control': 'no-store' } });
  }

  // `source` dice il bucket: un upload sta su canvas-assets, un disegno di modello su brand-knowledge.
  // La riga è già provata dell'org tramite `findAsset` con il client dell'utente; la firma passa
  // alla service role perché brand-knowledge è per-utente e l'asset può essere di un collega.
  const serviceDb = createAssetSigningDb();
  const signedUrls = await signAssetPaths(db, serviceDb, {
    generated: asset.source === 'generated' ? [path] : [],
    uploaded: asset.source !== 'generated' ? [path] : []
  }, undefined, asset.type === 'image' ? IMAGE_PRESET_OF[sizeOf(url)] : undefined);
  const signed = signedUrls.get(path) ?? null;

  if (!signed) {
    throw error(404, 'File not found');
  }

  return new Response(null, {
    status: 302,
    headers: { Location: signed, 'Cache-Control': 'no-store' }
  });
};
