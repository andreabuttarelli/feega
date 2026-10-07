import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('a composition holds video tracks only', () => {
  it('edit_comp refuses an audio track inside a composition and points to the root', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('precompose', { clip_ids: ['id1'] });
    const before = JSON.stringify(session.doc);

    const out = await run('edit_comp', { comp: 'id2', calls: [{ tool: 'add_track', input: { kind: 'audio' } }] });

    expect(out.ok).toBe(false);
    expect(String(out.error)).toMatch(/root|whole video/);
    expect(JSON.stringify(session.doc)).toBe(before);
  });

  it('a nested edit that leaves an invalid doc comes back as an error and changes nothing', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('precompose', { clip_ids: ['id1'] });

    await run('edit_comp', { comp: 'id2', calls: [{ tool: 'add_clip', input: { component: 'Kicker', start: 0, duration: 1 } }] });

    expect(parseMotionDoc(session.doc).ok).toBe(true);
  });
});

describe('motion agent precomp tools', () => {
  it('precompose moves clips into a named composition and leaves a precomp clip', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 1, duration: 2 });
    await run('add_clip', { component: 'Caption', start: 2, duration: 2 });

    const out = await run('precompose', { clip_ids: ['id1', 'id2'], name: 'Intro' });

    expect(out).toMatchObject({ ok: true, comp: 'id3', clip_id: 'id4' });
    expect(findClip(session.doc, 'id4')!.clip).toMatchObject({ component: 'Precomp', from: 30, durationInFrames: 90, props: { comp: 'id3' } });
    expect(session.doc.comps.id3.name).toBe('Intro');
  });

  it('edit_comp runs other tools inside the composition and saves into it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('precompose', { clip_ids: ['id1'] });

    const out = await run('edit_comp', {
      comp: 'id2',
      calls: [
        { tool: 'set_props', input: { clip_id: 'id1', props: { text: 'Inside' } } },
        { tool: 'add_clip', input: { component: 'Kicker', start: 0.5, duration: 1 } }
      ]
    });

    expect(out.ok).toBe(true);
    const tracks = session.doc.comps.id2.tracks;
    expect(tracks.flatMap((t) => t.clips.map((c) => c.component))).toEqual(['Title', 'Kicker']);
    expect(tracks[0].clips[0].props.text).toBe('Inside');
    expect(findClip(session.doc, 'id1')).toBeNull();
    expect(parseMotionDoc(session.doc).ok).toBe(true);
  });

  it('edit_comp stops at the first failing call and keeps what came before', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('precompose', { clip_ids: ['id1'] });

    const out = await run('edit_comp', { comp: 'id2', calls: [{ tool: 'set_props', input: { clip_id: 'id1', props: { text: 'A' } } }, { tool: 'set_props', input: { clip_id: 'nope', props: {} } }] });

    expect(out).toMatchObject({ ok: false, failed: 1 });
    expect(session.doc.comps.id2.tracks[0].clips[0].props.text).toBe('A');
  });

  it('edit_comp refuses an unknown composition', async () => {
    const { run } = setup();

    expect((await run('edit_comp', { comp: 'nope', calls: [] })).ok).toBe(false);
  });

  it('add_adjustment_layer puts a layer on top whose effects reach everything below', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });

    const out = await run('add_adjustment_layer', { start: 0.5, duration: 1 });

    expect(out).toMatchObject({ ok: true, clip_id: 'id2' });
    expect(session.doc.tracks[0].clips[0]).toMatchObject({ id: 'id2', component: 'Adjustment', from: 15, durationInFrames: 30 });
  });

  it('get_motion_doc lists the compositions', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('precompose', { clip_ids: ['id1'], name: 'Logo sting' });

    const doc = await run('get_motion_doc', {});

    expect(doc.comps).toEqual([{ id: 'id2', name: 'Logo sting', duration: 2, clips: ['id1'] }]);
  });
});
