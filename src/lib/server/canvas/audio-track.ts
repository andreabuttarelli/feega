import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import type { AudioFile } from './audio-provider';

const run = promisify(execFile);
const TRACK_MIME = 'audio/mpeg';
const TRACK_BITRATE = '192k';

export async function extractAudioTrack(video: AudioFile): Promise<AudioFile> {
  const ffmpeg = await ensureFfmpegPath();
  if (!ffmpeg) {
    throw new Error('audio_track_failed: ffmpeg unavailable');
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), 'audio-track-'));
  try {
    const input = path.join(dir, 'in');
    const output = path.join(dir, 'track.mp3');
    await writeFile(input, video.bytes);
    await run(ffmpeg, ['-y', '-loglevel', 'error', '-i', input, '-vn', '-c:a', 'libmp3lame', '-b:a', TRACK_BITRATE, output]);
    return { bytes: new Uint8Array(await readFile(output)), mime: TRACK_MIME };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
