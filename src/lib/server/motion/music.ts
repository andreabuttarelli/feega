import type { Db } from '$lib/server/db/client';
import { configuredAudioProvider } from '$lib/server/elevenlabs-config';
import { insertAsset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { MusicSource, musicSource, pickTrack, type Mood } from '$lib/motion/music-library';
import { libraryBytes } from './music-files';
import { Sound, generateSound, type VoiceoverScope } from './voiceover';
import type { Music } from './motion-tools';

const MP3 = 'audio/mpeg';

type MusicAsk = { mood: Mood; bpm?: number; seconds: number };

const LAY: Record<MusicSource, (db: Db, scope: VoiceoverScope, ask: MusicAsk) => Promise<Music>> = {
  [MusicSource.Generated]: async (db, scope, ask) => {
    const text = `${ask.mood} instrumental music for a product launch film${ask.bpm ? `, ${ask.bpm} bpm` : ''}, steady beat, no vocals`;
    const out = await generateSound(db, scope, Sound.Music, { text, seconds: ask.seconds });
    return out.ok ? { ...out, source: MusicSource.Generated, track: 'generated' } : out;
  },
  [MusicSource.Library]: async (db, scope, ask) => {
    const track = pickTrack(ask);
    const path = `${scope.orgId}/${scope.projectId}/music/${crypto.randomUUID()}-${track.file}`;
    const bytes = await libraryBytes(track.file);
    const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, new Blob([bytes as BlobPart], { type: MP3 }), { contentType: MP3, upsert: false });
    if (error) {
      return { ok: false, error: `store_failed: ${error.message}` };
    }
    const asset = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'audio', source: 'upload', url: path, mimeType: MP3, bytes: bytes.byteLength, durationS: track.seconds, sourceNodeId: scope.nodeId });
    const signed = await signAssetPaths(db, createAssetSigningDb(), { generated: [], uploaded: [path] });
    return { ok: true, assetId: asset.id, seconds: track.seconds, url: signed.get(path) ?? null, source: MusicSource.Library, track: track.id };
  }
};

export function layMusic(db: Db, scope: VoiceoverScope, ask: MusicAsk): Promise<Music> {
  return LAY[musicSource({ generator: configuredAudioProvider() !== null })](db, scope, ask);
}
