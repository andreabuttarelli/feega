import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { AssetKind } from '$lib/motion/components';
import { MotionFormat, clipsOf, newMotionDoc, type MotionClip } from '$lib/motion/doc';
import { CardKind, type RingCard } from '$lib/motion/ring/model';
import { createMotionTools, type MotionSession } from './motion-tools';

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets = [{ id: 'shot', kind: AssetKind.Image, label: 'Dashboard shot', url: 'https://cdn.example/shot.png' }];
  const tools = createMotionTools({ session, assets: assets as never, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  const ring = () => clipsOf(session.doc).find((c) => c.component === 'Ring') as MotionClip | undefined;
  return { session, run, ring };
}

describe('ring tools', () => {
  it('adds a ring whose cards are dashboard compositions it builds', async () => {
    const { session, run, ring } = setup();

    const result = await run('add_ring', { start: 0, duration: 8, sample: true });

    expect(result).toMatchObject({ ok: true });
    const cards = ring()!.props.cards as RingCard[];
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards.every((c) => c.kind === CardKind.Comp && session.doc.comps[c.ref])).toBe(true);
  });

  it('puts pictures and existing compositions on the cards, with the ring settings it is given', async () => {
    const { run, ring } = setup();

    await run('add_ring', { start: 0, cards: [{ kind: 'image', ref: 'shot' }], props: { count: 5, tiltX: -20, ringRadius: 540 } });

    expect(ring()!.props).toMatchObject({ count: 5, tiltX: -20, cards: [{ kind: 'image', ref: 'shot' }] });
    expect(ring()!.props.ringRadius).toBeCloseTo(0.5);
  });

  it('refuses a card that names nothing the video has', async () => {
    const { run, ring } = setup();

    expect(await run('add_ring', { start: 0, cards: [{ kind: 'image', ref: 'ghost' }] })).toMatchObject({ ok: false });
    expect(await run('add_ring', { start: 0, cards: [{ kind: 'comp', ref: 'ghost' }] })).toMatchObject({ ok: false });
    expect(ring()).toBeUndefined();
  });

  it('keyframes the ring like any other prop', async () => {
    const { run, ring } = setup();
    await run('add_ring', { start: 0, sample: true });

    const result = await run('set_keyframes', { clip_id: ring()!.id, prop: 'tiltZ', keyframes: [{ time: 0, value: -10 }, { time: 2, value: 10 }] });

    expect(result).toMatchObject({ ok: true });
    expect(ring()!.keyframes.tiltZ.map((k) => k.value)).toEqual([-10, 10]);
  });
});
