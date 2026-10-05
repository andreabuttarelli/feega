import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { createMotionTools, selectionNote, type MotionSession, type MotionToolDeps } from './motion-tools';
import { MAX_VIEWS_PER_TURN } from './frames';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(overrides: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Vertical), baseVersion: 3, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const deps: MotionToolDeps = {
    session,
    assets: [{ id: 'glb-1', kind: AssetKind.Model3d, label: 'shoe', previewUrl: '/x', url: 'https://cdn/x.glb' }],
    newId: () => `id${++n}`,
    voiceover: vi.fn(async () => ({ ok: true as const, assetId: 'vo-1', seconds: 4, url: 'https://cdn/vo.mp3' })),
    frames: vi.fn(async (_callId: string, times: number[]) => times.map((time) => ({ time, bytes: Buffer.from([1]) }))),
    check: vi.fn(async () => null),
    ...overrides
  };
  const tools = createMotionTools(deps);
  let call = 0;
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: `call-${++call}` });
  const schema = (name: string) => (tools[name] as Tool & { inputSchema: { safeParse: (x: unknown) => { success: boolean } } }).inputSchema;
  return { session, deps, run, schema };
}

describe('motion agent tools at another frame rate', () => {
  it('set_canvas changes the frame rate and every time the agent reads or writes stays in seconds', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 1, duration: 2 });

    expect((await run('set_canvas', { fps: 60 })).ok).toBe(true);
    expect(session.doc.fps).toBe(60);
    expect(session.doc.tracks[0].clips[0]).toMatchObject({ from: 60, durationInFrames: 120 });

    await run('add_clip', { component: 'Title', start: 4, duration: 1 });
    const doc = (await run('get_motion_doc', {})) as { fps: number; tracks: { clips: { start: number; duration: number }[] }[] };

    expect(doc.fps).toBe(60);
    expect(doc.tracks[0].clips.map((c) => [c.start, c.duration])).toEqual([
      [1, 2],
      [4, 1]
    ]);
  });

  it('set_canvas makes the background transparent for alpha exports', async () => {
    const { session, run } = setup();

    expect((await run('set_canvas', { background: 'transparent' })).ok).toBe(true);
    expect(session.doc.background).toBe('transparent');
    expect(((await run('get_motion_doc', {})) as { background: string }).background).toBe('transparent');
  });

  it('set_canvas refuses a rate the renderer does not make', async () => {
    const { schema } = setup();

    expect(schema('set_canvas').safeParse({ fps: 29 }).success).toBe(false);
  });
});

describe('motion blur through the agent', () => {
  it('set_motion_blur turns the shutter on for the video and keeps the rest as it was', async () => {
    const { session, run } = setup();

    expect((await run('set_motion_blur', { enabled: true, shutter_angle: 270 })).ok).toBe(true);
    expect(session.doc.motionBlur).toEqual({ enabled: true, shutterAngle: 270, shutterPhase: -90, samples: 8 });
    expect(((await run('get_motion_doc', {})) as { motionBlur: { enabled: boolean } }).motionBlur.enabled).toBe(true);
  });

  it('set_motion_blur leaves chosen clips sharp and the agent reads it back per clip', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });

    expect((await run('set_motion_blur', { clip_ids: ['id1'], clips_blur: false })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')?.clip.motionBlur).toBe(false);
    const doc = (await run('get_motion_doc', {})) as { tracks: { clips: { motionBlur: boolean }[] }[] };
    expect(doc.tracks[0].clips[0].motionBlur).toBe(false);
  });

  it('an unknown clip is refused and nothing changes', async () => {
    const { session, run } = setup();
    const before = session.doc;

    expect((await run('set_motion_blur', { clip_ids: ['nope'], clips_blur: false })).ok).toBe(false);
    expect(session.doc).toBe(before);
  });
});

describe('motion agent tools', () => {
  it('set_track renames and reorders a track; remove_track drops it with its clips', async () => {
    const { session, run } = setup();
    await run('add_track', { kind: 'visual' });
    await run('add_clip', { component: 'Title', start: 0, track_id: 'v1' });

    expect((await run('set_track', { track_id: 'v1', name: 'Titles', index: 0 })).ok).toBe(true);
    expect(session.doc.tracks[0]).toMatchObject({ id: 'v1', name: 'Titles' });
    expect((await run('remove_track', { track_id: 'v1' })).ok).toBe(true);
    expect(session.doc.tracks.some((t) => t.id === 'v1')).toBe(false);
    expect(findClip(session.doc, 'id2')).toBeNull();
  });

  it('remove_asset unregisters an asset only when nothing uses it', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Model3D', start: 0, props: { assetId: 'glb-1' } });

    expect(String((await run('remove_asset', { asset_id: 'glb-1' })).error)).toContain('id1');
    await run('remove_clip', { clip_ids: ['id1'] });
    expect((await run('remove_asset', { asset_id: 'glb-1' })).ok).toBe(true);
    expect(session.doc.assets).toEqual([]);
  });

  it('add_clip places a library component at a time in seconds', async () => {
    const { session, run } = setup();
    const out = await run('add_clip', { component: 'Title', start: 1, duration: 2, props: { text: 'Hi' } });

    expect(out.ok).toBe(true);
    expect(findClip(session.doc, 'id1')?.clip).toMatchObject({ from: 30, durationInFrames: 60, props: { text: 'Hi' } });
    expect(session.edits).toEqual(['added Title']);
  });

  it('a 3D clip registers its model in the doc assets', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Model3D', start: 0, props: { assetId: 'glb-1', orbitSpeed: 30 } });

    expect(session.doc.assets).toEqual([{ id: 'glb-1', kind: 'model3d', name: 'shoe' }]);
  });

  it('refuses an asset that is not in the project', async () => {
    const { session, run } = setup();
    const out = await run('add_clip', { component: 'Image', start: 0, props: { assetId: 'stranger' } });

    expect(out.ok).toBe(false);
    expect(session.edits).toEqual([]);
  });

  it('invalid props come back as an error and leave the doc alone', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    const before = session.doc;
    const out = await run('set_props', { clip_id: 'id1', props: { opacity: 700 } });

    expect(out.ok).toBe(false);
    expect(session.doc).toBe(before);
  });

  it('the input schema rejects a component outside the library', () => {
    const { schema } = setup();

    expect(schema('add_clip').safeParse({ component: 'Iframe', start: 0 }).success).toBe(false);
  });

  it('generate_voiceover places the speech on the audio track', async () => {
    const { session, run, deps } = setup();
    await run('generate_voiceover', { text: 'Meet feega.', start: 1 });

    expect(deps.voiceover).toHaveBeenCalledWith({ text: 'Meet feega.', voiceId: undefined });
    expect(findClip(session.doc, 'id1')).toMatchObject({ track: { kind: 'audio' }, clip: { from: 30, durationInFrames: 120, props: { assetId: 'vo-1' } } });
  });

  it('a refused voice-over changes nothing', async () => {
    const { session, run } = setup({ voiceover: async () => ({ ok: false, error: 'elevenlabs_not_configured' }) });
    const out = await run('generate_voiceover', { text: 'x', start: 0 });

    expect(out).toEqual({ ok: false, error: 'elevenlabs_not_configured' });
    expect(session.edits).toEqual([]);
  });

  it('the selection is part of what the agent reads', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    session.selection = ['id1'];

    expect((await run('get_motion_doc', {})).selected).toEqual(['id1']);
    expect(selectionNote(session.doc, ['id1'])).toContain('Title id1 (0s–3s)');
  });

  it('a set_props with a timing key says which props exist and that timing is set_timing', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'BrandBackground', start: 0 });
    const out = await run('set_props', { clip_id: 'id1', props: { duration: 20 } });

    expect(out.ok).toBe(false);
    expect(out.error).toContain('duration');
    expect(out.error).toContain('set_timing');
    expect(out.error).toContain('fill');
  });

  it('an unknown clip id lists the clips that exist', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Title', start: 0 });
    const out = await run('set_props', { clip_id: 'nope', props: { text: 'x' } });

    expect(out).toMatchObject({ ok: false });
    expect(out.error).toContain('id1');
  });

  it('view_frames asks the open preview for those exact times and keeps the frames for the next step', async () => {
    const { session, run, deps } = setup();
    const out = await run('view_frames', { times: [0.5, 2] });

    expect(deps.frames).toHaveBeenCalledWith('call-1', [0.5, 2]);
    expect(out).toMatchObject({ ok: true, times: [0.5, 2] });
    expect(session.frames.get('call-1')).toHaveLength(2);
  });

  it('view_frames takes at most six times', () => {
    const { schema } = setup();

    expect(schema('view_frames').safeParse({ times: [0, 1, 2, 3, 4, 5, 6] }).success).toBe(false);
    expect(schema('view_frames').safeParse({ times: [] }).success).toBe(false);
  });

  it('with no preview open the agent is told so instead of waiting forever', async () => {
    const { run } = setup({ frames: async () => null });
    const out = await run('view_frames', { times: [1] });

    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('preview');
  });

  it('a turn cannot look at frames more than its budget allows', async () => {
    const { run, deps } = setup();
    for (let i = 0; i < MAX_VIEWS_PER_TURN; i++) {
      await run('view_frames', { times: [1] });
    }
    const out = await run('view_frames', { times: [1] });

    expect(out.ok).toBe(false);
    expect(deps.frames).toHaveBeenCalledTimes(MAX_VIEWS_PER_TURN);
  });
});
