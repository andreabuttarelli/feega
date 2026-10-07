import { read } from '$app/server';

const FILES = import.meta.glob('/src/lib/motion/music/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export async function libraryBytes(file: string): Promise<Uint8Array> {
  const url = FILES[`/src/lib/motion/music/${file}`];
  if (!url) {
    throw new Error(`music_track_missing: ${file}`);
  }
  return new Uint8Array(await read(url).arrayBuffer());
}
