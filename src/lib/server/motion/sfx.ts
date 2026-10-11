import { read } from '$app/server';
import type { Db } from '$lib/server/db/client';
import { insertAsset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { SFX_LIBRARY, type Sfx } from '$lib/motion/sfx';
import type { VoiceoverScope } from './voiceover';
import type { SfxAsset } from './motion-tools';

const MP3 = 'audio/mpeg';
const FILES = import.meta.glob('/src/lib/motion/sfx/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export async function laySfx(db: Db, scope: VoiceoverScope, sfx: Sfx): Promise<SfxAsset> {
  const sound = SFX_LIBRARY[sfx];
  const url = FILES[`/src/lib/motion/sfx/${sound.file}`];
  if (!url) {
    return { ok: false, error: `sfx_missing: ${sound.file}` };
  }
  const bytes = new Uint8Array(await read(url).arrayBuffer());
  const path = `${scope.orgId}/${scope.projectId}/sfx/${crypto.randomUUID()}-${sound.file}`;
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, new Blob([bytes as BlobPart], { type: MP3 }), { contentType: MP3, upsert: false });
  if (error) {
    return { ok: false, error: `store_failed: ${error.message}` };
  }
  const asset = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'audio', source: 'upload', url: path, mimeType: MP3, bytes: bytes.byteLength, durationS: sound.seconds, sourceNodeId: scope.nodeId });
  const signed = await signAssetPaths(db, createAssetSigningDb(), { generated: [], uploaded: [path] });
  return { ok: true, assetId: asset.id, url: signed.get(path) ?? null, seconds: sound.seconds };
}
