import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { AssetKind } from '@feega/motion-core/motion/components';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { movingSquare, SQUARE_SIZE } from '@feega/motion-core/motion/tracking/scene';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const W = 160;
const H = 90;
const CENTRE = SQUARE_SIZE / 2;
const FPS = 30;
const FOLLOW = { mode: 'follow', offset_x: 0, offset_y: 0 };

const squareReader = async (seconds: number[]) => seconds.map((s) => movingSquare(W, H, 20 + Math.round(s * FPS) * 3, 20 + Math.round(s * FPS)));

function setup(extra: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets = [{ id: 'a1', kind: AssetKind.Video, label: 'square', previewUrl: '', url: 'https://signed/square.mp4' }];
  const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...extra });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

async function withClips(run: ReturnType<typeof setup>['run']) {
  await run('add_clip', { component: 'Video', start: 0, duration: 1.5, props: { assetId: 'a1' } });
  await run('add_clip', { component: 'Title', start: 0, duration: 3 });
}

const pxX = (frame: number) => ((20 + frame * 3 + CENTRE) / W) * 1920;
const pxY = (frame: number) => ((20 + frame + CENTRE) / H) * 1080;

describe('motion agent track_point and apply_track', () => {
  it('tracks a point and attaches it to a title as position keyframes', async () => {
    const reader = vi.fn(() => squareReader);
    const { session, run } = setup({ trackReader: reader });
    await withClips(run);

    const tracked = await run('track_point', { clip_id: 'id1', time: 0, x: pxX(0), y: pxY(0), to: 1 });
    const applied = await run('apply_track', { track_id: tracked.track_id, target_clip_id: 'id2', ...FOLLOW });

    expect(tracked).toMatchObject({ ok: true, lost: false, frames: 31 });
    expect(reader).toHaveBeenCalledWith('https://signed/square.mp4');
    expect(applied.ok).toBe(true);
    const x = findClip(session.doc, 'id2')!.clip.keyframes.x;
    expect(x).toHaveLength(31);
    expect(Math.abs(x[30].value as number + 0.5 - (20 + 30 * 3 + CENTRE) / W)).toBeLessThan(0.01);
  });

  it('stabilises the video against the tracked point', async () => {
    const { session, run } = setup({ trackReader: () => squareReader });
    await withClips(run);
    const tracked = await run('track_point', { clip_id: 'id1', time: 0, x: pxX(0), y: pxY(0), to: 1 });

    const out = await run('apply_track', { track_id: tracked.track_id, target_clip_id: 'id1', mode: 'stabilise', offset_x: 0, offset_y: 0 });

    expect(out.ok).toBe(true);
    const x = findClip(session.doc, 'id1')!.clip.keyframes.x;
    expect(x[0].value).toBe(0);
    expect(x[30].value as number).toBeLessThan(-0.3);
  });

  it('says why a clip cannot be tracked', async () => {
    const { run } = setup({ trackReader: () => squareReader });
    await withClips(run);

    expect(await run('track_point', { clip_id: 'id2', x: 10, y: 10 })).toMatchObject({ ok: false, error: expect.stringContaining('Video') });
    expect(await run('apply_track', { track_id: 'nope', target_clip_id: 'id2', ...FOLLOW })).toMatchObject({ ok: false, error: expect.stringContaining('nope') });
  });

  it('says so when there is no way to read video here', async () => {
    const { run } = setup();
    await withClips(run);

    expect(await run('track_point', { clip_id: 'id1', x: 10, y: 10 })).toMatchObject({ ok: false, error: expect.stringContaining('tracking') });
  });

  it('says so when the video clip has no file yet', async () => {
    const { run } = setup({ trackReader: () => squareReader });
    await run('add_clip', { component: 'Video', start: 0, duration: 1 });

    expect(await run('track_point', { clip_id: 'id1', x: 10, y: 10 })).toMatchObject({ ok: false, error: expect.stringContaining('asset') });
  });

  it('applies a track in a later call that starts from the saved doc', async () => {
    const first = setup({ trackReader: () => squareReader });
    await withClips(first.run);
    const tracked = await first.run('track_point', { clip_id: 'id1', time: 0, x: pxX(0), y: pxY(0), to: 1 });

    const later = setup({ trackReader: () => squareReader });
    later.session.doc = first.session.doc;
    const applied = await later.run('apply_track', { track_id: tracked.track_id, target_clip_id: 'id2', ...FOLLOW });

    expect(applied.ok).toBe(true);
    expect(findClip(later.session.doc, 'id2')!.clip.keyframes.x).toHaveLength(31);
  });
});
