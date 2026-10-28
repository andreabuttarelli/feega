import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { movingSquare, SQUARE_SIZE } from '@feega/motion-core/motion/tracking/scene';
import { trackClip } from '@feega/motion-core/motion/tracking/track-clip';
import { peekFfmpegPath } from '$lib/server/ffmpeg-bin';
import { ffmpegLumas } from './track-frames';

const W = 320;
const H = 180;
const FPS = 30;
const FRAMES = 40;
const CENTRE = SQUARE_SIZE / 2;
const STEP_X = 4;
const STEP_Y = 2;
const FFMPEG = peekFfmpegPath() ?? 'ffmpeg';

const squareLeft = (i: number) => 30 + i * STEP_X;
const squareTop = (i: number) => 30 + i * STEP_Y;

let dir = '';
let video = '';

function encode(path: string) {
  const raw = Buffer.concat(Array.from({ length: FRAMES }, (_, i) => Buffer.from(movingSquare(W, H, squareLeft(i), squareTop(i)).data)));
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'mpeg4', '-q:v', '2', '-pix_fmt', 'yuv420p', path], { input: raw });
}

function docWithVideo(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Video', from: 0, durationInFrames: FRAMES }, 'v1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'track-'));
  video = join(dir, 'square.mp4');
  encode(video);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('tracking a real encoded video', () => {
  it('reads the frames of a clip as luminance at the asked width', async () => {
    const [first, second] = await ffmpegLumas(video)([0, 1 / FPS]);

    expect(first.width).toBe(W);
    expect(first.height).toBe(H);
    expect(second.data).not.toEqual(first.data);
  });

  it('follows the moving square through the ffmpeg frames', async () => {
    const doc = docWithVideo();
    const point = { x: (squareLeft(0) + CENTRE) / W, y: (squareTop(0) + CENTRE) / H };

    const out = await trackClip(doc, { clipId: 'v1', frame: 0, point, range: { from: 0, to: FRAMES - 1 } }, ffmpegLumas(video));

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(out.track.lost).toBe(false);
    expect(out.track.points).toHaveLength(FRAMES);
    for (const p of out.track.points) {
      expect(Math.abs(p.x * W - (squareLeft(p.frame) + CENTRE))).toBeLessThan(1.5);
      expect(Math.abs(p.y * H - (squareTop(p.frame) + CENTRE))).toBeLessThan(1.5);
    }
  });

  it('tracks backward from the last frame', async () => {
    const doc = docWithVideo();
    const last = FRAMES - 1;
    const point = { x: (squareLeft(last) + CENTRE) / W, y: (squareTop(last) + CENTRE) / H };

    const out = await trackClip(doc, { clipId: 'v1', frame: last, point, range: { from: 0, to: last } }, ffmpegLumas(video));

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(out.track.points[0].frame).toBe(0);
    expect(Math.abs(out.track.points[0].x * W - (squareLeft(0) + CENTRE))).toBeLessThan(1.5);
  });

  it('refuses frame times that are not evenly spaced, such as a remapped clip', async () => {
    await expect(ffmpegLumas(video)([0, 0.1, 0.5])).rejects.toThrow(/evenly/);
  });
});
