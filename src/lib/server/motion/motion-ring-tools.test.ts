import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { AssetKind } from '$lib/motion/components';
import { MotionFormat, clipsOf, newMotionDoc, type MotionClip } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets = [{ id: 'shot', kind: AssetKind.Image, label: 'Dashboard shot', url: 'https://cdn.example/shot.png' }];
  const tools = createMotionTools({ session, assets: assets as never, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  const ring = () => clipsOf(session.doc).find((c) => c.component === 'Composition') as MotionClip | undefined;
  return { session, run, ring };
}

describe('the agent builds a ring with the composition tools it already has', () => {
  it('lays a composition out as a ring of UI cards built in a precomp', async () => {
    const { session, run, ring } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 4 });
    const title = clipsOf(session.doc)[0].id;
    await run('precompose', { clip_ids: [title], name: 'KPI' });
    const comp = Object.keys(session.doc.comps)[0];

    const result = await run('add_clip', { component: 'Composition', start: 0, duration: 8, props: { layout: 'ring', media: [{ kind: 'comp', assetId: comp }], layoutParams: { count: 6, tiltX: -20 } } });

    expect(result).toMatchObject({ ok: true });
    expect(ring()!.props).toMatchObject({ layout: 'ring', layoutParams: { count: 6, tiltX: -20 } });
  });

  it('keyframes the ring numbers', async () => {
    const { run, ring } = setup();
    await run('add_clip', { component: 'Composition', start: 0, duration: 8, props: { layout: 'ring' } });

    const result = await run('set_keyframes', { clip_id: ring()!.id, prop: 'tiltZ', keyframes: [{ time: 0, value: -10 }, { time: 2, value: 10 }] });

    expect(result).toMatchObject({ ok: true });
    expect(ring()!.keyframes.tiltZ.map((k) => k.value)).toEqual([-10, 10]);
  });
});
