import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { BREAKDOWN_VERSION } from '$lib/video-reference';
import { BreakdownError, assetBreakdown, breakdownPath } from './video-reference';

const answer = JSON.stringify({
  summary: 'Prompt typed, result appears.',
  durationS: 6,
  scenes: [{ start: 0, end: 6, description: 'Prompt field', onScreenText: ['Make it move'], ui: ['prompt input'], camera: 'zoom', transitionOut: 'cut' }],
  pacing: { cutsPerMinute: 10, rhythm: 'slow holds' }
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v-1', project_id: 'p-1', type: 'video', url: 'org-1/p-1/chat/u__ref.mp4', content: null, mime_type: 'video/mp4', bytes: 10,
  width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-16', ...over
});

const clear = () => ({ watch: vi.fn(async () => answer), screen: vi.fn(async () => ({ ok: true as const })) });
const ref = { orgId: 'org-1', projectId: 'p-1', assetId: 'v-1' };
const cachePath = breakdownPath({ orgId: 'org-1', projectId: 'p-1', assetId: 'v-1' });

describe('assetBreakdown', () => {
  it('watches the signed video once and stores the breakdown next to the asset', async () => {
    const { db, calls } = fakeDb({ assets: [row()] }, { files: {} });
    const ports = clear();

    const out = await assetBreakdown(db, ports, ref);

    expect(out).toMatchObject({ ok: true, breakdown: { version: BREAKDOWN_VERSION, durationS: 6 } });
    expect(ports.watch).toHaveBeenCalledWith('https://signed.example/canvas-assets/org-1/p-1/chat/u__ref.mp4');
    const stored = calls.find((c) => c.op === 'upload')!;
    expect(stored.filters).toEqual([['path', cachePath]]);
    expect(out.ok && out.brief).toContain('Text: "Make it move"');
  });

  it('a stored breakdown answers without calling the model again', async () => {
    const cached = JSON.stringify({ version: BREAKDOWN_VERSION, ...JSON.parse(answer), voiceover: [], palette: [], typography: [], music: '' });
    const { db } = fakeDb({ assets: [row()] }, { files: { [cachePath]: new TextEncoder().encode(cached) } });
    const ports = clear();

    const out = await assetBreakdown(db, ports, ref);

    expect(out.ok).toBe(true);
    expect(ports.watch).not.toHaveBeenCalled();
    expect(ports.screen).not.toHaveBeenCalled();
  });

  it('a generated video is signed from the bucket that holds it', async () => {
    const { db } = fakeDb({ assets: [row({ source: 'generated', url: 'u-1/media/clip.mp4' })] }, { files: {} });
    const ports = clear();

    await assetBreakdown(db, ports, ref);

    expect(ports.watch).toHaveBeenCalledWith('https://signed.example/brand-knowledge/u-1/media/clip.mp4');
  });

  it('a video refused by the reference review is never sent to the model', async () => {
    const { db, calls } = fakeDb({ assets: [row()] }, { files: {} });
    const ports = { ...clear(), screen: vi.fn(async () => ({ ok: false as const, error: 'Refused: people' })) };

    const out = await assetBreakdown(db, ports, ref);

    expect(out).toMatchObject({ ok: false, error: BreakdownError.Refused, message: 'Refused: people' });
    expect(ports.watch).not.toHaveBeenCalled();
    expect(calls.some((c) => c.op === 'upload')).toBe(false);
  });

  it('an image or a missing asset is not a video to read', async () => {
    const { db } = fakeDb({ assets: [row({ type: 'image' })] }, { files: {} });

    expect(await assetBreakdown(db, clear(), ref)).toMatchObject({ ok: false, error: BreakdownError.NotVideo });
    const empty = fakeDb({ assets: [] }, { files: {} }).db;
    expect(await assetBreakdown(empty, clear(), ref)).toMatchObject({ ok: false, error: BreakdownError.NotFound });
  });

  it('a video of another project of the org is not this project\'s to read; a library video is', async () => {
    const other = fakeDb({ assets: [row({ project_id: 'p-2' })] }, { files: {} }).db;
    const library = fakeDb({ assets: [row({ project_id: null })] }, { files: {} }).db;

    expect(await assetBreakdown(other, clear(), ref)).toMatchObject({ ok: false, error: BreakdownError.NotFound });
    expect((await assetBreakdown(library, clear(), ref)).ok).toBe(true);
  });

  it('an answer that is not a breakdown is not cached as one', async () => {
    const { db, calls } = fakeDb({ assets: [row()] }, { files: {} });
    const ports = { ...clear(), watch: vi.fn(async () => 'Sorry, I cannot see videos.') };

    expect(await assetBreakdown(db, ports, ref)).toMatchObject({ ok: false, error: BreakdownError.Unreadable });
    expect(calls.some((c) => c.op === 'upload')).toBe(false);
  });
});
