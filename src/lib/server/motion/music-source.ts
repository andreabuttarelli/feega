import type { Db } from '$lib/server/db/client';
import { insertAsset } from '$lib/server/repos/assets';
import { signAssetFile, storeAssetFile } from '$lib/server/repos/asset-storage';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { MUSIC_BED_LICENSE, musicBed } from './music-bed';
import type { Voiceover } from './motion-tools';

const DEFAULT_BPM = 120;
const BPM = /(\d{2,3})\s*bpm/i;
const WAV = 'audio/wav';

type BedSpec = { seconds: number; bpm: number };

export type MusicPorts = {
  generate: () => Promise<Voiceover>;
  store: (wav: Buffer, spec: BedSpec) => Promise<Voiceover>;
};

export type Music = Voiceover & { license?: string };

export async function musicOrBed(ports: MusicPorts, input: { text: string; seconds: number }): Promise<Music> {
  const made = await ports.generate().catch((e: unknown): Voiceover => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  if (made.ok) {
    return made;
  }
  const spec = { seconds: input.seconds, bpm: Number(BPM.exec(input.text)?.[1] ?? DEFAULT_BPM) };
  const stored = await ports.store(musicBed(spec), spec);
  return stored.ok ? { ...stored, license: MUSIC_BED_LICENSE } : stored;
}

export async function storeBed(db: Db, scope: { orgId: string; projectId: string }, wav: Buffer, spec: BedSpec): Promise<Voiceover> {
  const path = `${canvasUploadPrefix(scope.orgId, scope.projectId)}music/${crypto.randomUUID()}.wav`;
  await storeAssetFile(db, path, new File([new Uint8Array(wav)], path.split('/').at(-1) as string, { type: WAV }));
  const row = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: 'audio', source: 'imported', url: path, content: `${MUSIC_BED_LICENSE} · ${spec.bpm} bpm`, mimeType: WAV, bytes: wav.length, durationS: spec.seconds });
  return { ok: true, assetId: row.id, seconds: spec.seconds, url: await signAssetFile(db, path) };
}
