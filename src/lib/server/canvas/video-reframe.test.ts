import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';
import { cropVideo, startVideoReframe, type VideoReframeDeps } from './video-reframe';

const db = {} as never;
const SCOPE = { orgId: 'org', projectId: 'p1', userId: 'u1' };

const source = { id: 'n-src', canvasId: 'c1', projectId: 'p1', type: 'video', displayName: 'Clip', position: { x: 100, y: 40, z: 0 }, size: { width: 320, height: 240 }, data: { refId: 'asset-1' }, version: 3 };

function deps(over: Partial<VideoReframeDeps> = {}): VideoReframeDeps {
  return {
    findNode: vi.fn(async () => source),
    readVideo: vi.fn(async () => ({ bytes: Buffer.from('mp4'), durationS: 4 })),
    cropVideo: vi.fn(async () => Buffer.from('cropped')),
    storeMp4: vi.fn(async () => ({ id: 'asset-out' })),
    createNode: vi.fn(async () => ({ id: 'n-out', version: 1 })),
    createConnection: vi.fn(async () => ({ id: 'e1' })),
    ...over
  } as unknown as VideoReframeDeps;
}

describe('startVideoReframe', () => {
  it('crops to the aspect around the focus and lands a wired video node beside the source', async () => {
    const d = deps();

    const out = await startVideoReframe(db, d, { ...SCOPE, sourceNodeId: 'n-src', aspect: '9:16', focus: { x: 0.2, y: 0.5 } });

    expect(out).toEqual({ ok: true, canvasId: 'c1', nodeId: 'n-out' });
    expect(d.cropVideo).toHaveBeenCalledWith(Buffer.from('mp4'), 9 / 16, { x: 0.2, y: 0.5 });
    expect(d.storeMp4).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org', projectId: 'p1', userId: 'u1', nodeId: 'n-src', bytes: Buffer.from('cropped'), durationS: 4 }));
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ canvasId: 'c1', type: 'video', displayName: 'Reframe 9:16', data: { refId: 'asset-out' } }));
    expect(d.createConnection).toHaveBeenCalledWith(db, expect.objectContaining({ sourceNodeId: 'n-src', targetNodeId: 'n-out' }));
  });

  it('refuses before writing when the node is missing, not a video, empty, unreadable or uncroppable', async () => {
    for (const [over, error] of [
      [{ findNode: vi.fn(async () => null) }, 'node_not_found'],
      [{ findNode: vi.fn(async () => ({ ...source, type: 'image' })) }, 'source_not_video'],
      [{ findNode: vi.fn(async () => ({ ...source, data: {} })) }, 'source_empty'],
      [{ readVideo: vi.fn(async () => null) }, 'source_unreadable'],
      [{ cropVideo: vi.fn(async () => null) }, 'reframe_failed']
    ] as const) {
      const d = deps(over as never);

      expect(await startVideoReframe(db, d, { ...SCOPE, sourceNodeId: 'n-src', aspect: '1:1' })).toEqual({ ok: false, error });
      expect(d.createNode).not.toHaveBeenCalled();
    }
  });
});

describe('cropVideo', () => {
  it('turns a landscape clip into the asked vertical size', async () => {
    const ffmpeg = await ensureFfmpegPath();
    if (!ffmpeg) {
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), 'reframe-test-'));
    const input = join(dir, 'in.mp4');
    spawnSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10:duration=1', '-pix_fmt', 'yuv420p', input]);

    const out = await cropVideo(readFileSync(input), 9 / 16);

    const result = join(dir, 'out.mp4');
    writeFileSync(result, out!);
    const log = spawnSync(ffmpeg, ['-hide_banner', '-i', result], { encoding: 'utf8' }).stderr;
    rmSync(dir, { recursive: true, force: true });
    expect(log).toContain('102x180');
  });
});
