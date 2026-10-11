import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { videoStills } from './video-stills';

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.runIf(hasFfmpeg())('video stills', () => {
  it('takes one jpeg per point of a real clip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stills-test-'));
    const file = join(dir, 'clip.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x240:rate=10', '-pix_fmt', 'yuv420p', file]);

    const stills = await videoStills(readFileSync(file), [0.25, 0.5, 0.75], 'ffmpeg');
    rmSync(dir, { recursive: true, force: true });

    expect(stills).toHaveLength(3);
    for (const still of stills) {
      expect(await sharp(still).metadata()).toMatchObject({ format: 'jpeg', width: 320, height: 240 });
    }
  });

  it('bytes that are not a video are refused', async () => {
    await expect(videoStills(Buffer.from('not a video'), [0.5], 'ffmpeg')).rejects.toThrow(/not a video/);
  });
});
