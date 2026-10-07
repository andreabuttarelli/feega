import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { createMotionTools, type MotionSession } from './motion-tools';
import type { MotionAsset } from './editor';

const CAPTURE: MotionAsset = { id: 'page', kind: AssetKind.Image, label: 'supasito.com', previewUrl: '', url: 'https://signed/page.png', width: 2880, height: 1800 };

type Result = { ok: boolean; error?: string; clip_id?: string };

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  let n = 0;
  const tools = createMotionTools({ session, assets: [CAPTURE], newId: () => `c${n++}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Result> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const fullFrame = (zoom: number) => ({ component: 'Image', start: 0, duration: 2, props: { assetId: 'page', fit: 'cover', zoom } });

describe('a capture blown up past its pixels is refused, not just named', () => {
  it('supasito: a 2880×1800 capture zoomed 2.4 in full frame (1.6×) never lands', async () => {
    const { session, run } = setup();
    const before = session.doc;

    const out = await run('add_clip', fullFrame(2.4));

    expect(out.ok).toBe(false);
    expect(out.error).toContain('1.6×');
    expect(session.doc).toBe(before);
    expect(session.edits).toEqual([]);
  });

  it('zooming a sharp clip past 1.25× with set_props is refused and the clip keeps its zoom', async () => {
    const { session, run } = setup();
    const added = await run('add_clip', fullFrame(1.5));
    expect(added.ok).toBe(true);

    const out = await run('set_props', { clip_id: added.clip_id, props: { zoom: 2.4 } });

    expect(out.ok).toBe(false);
    const clip = session.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === added.clip_id);
    expect(clip?.props.zoom).toBe(1.5);
  });

  it('a capture shown at its own resolution or a little above (≤ 1.25×) is fine', async () => {
    const { run } = setup();
    expect((await run('add_clip', fullFrame(1.85))).ok).toBe(true);
  });
});
