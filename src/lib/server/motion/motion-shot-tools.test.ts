import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { SHOT_IDS, ShotId } from '$lib/motion/shots/library';
import { VectorKind, VectorRole, type VectorUi } from '$lib/motion/vector-ui/model';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const UI: VectorUi = {
  url: 'https://feega.test/app',
  title: 'feega',
  width: 1280,
  height: 800,
  background: 'rgb(250, 250, 248)',
  fonts: ['DM Sans'],
  raster: ['image-0'],
  nodes: [
    { id: 'heading-0', role: VectorRole.Heading, kind: VectorKind.Text, x: 576, y: 185, w: 348, h: 75, text: 'make a video.', size: 64, font: 'DM Sans' },
    { id: 'input-0', role: VectorRole.Input, kind: VectorKind.Box, x: 407, y: 307, w: 686, h: 56, fill: 'rgb(255, 255, 255)' },
    { id: 'button-0', role: VectorRole.Button, kind: VectorKind.Box, x: 1053, y: 371, w: 40, h: 40, fill: 'rgb(0, 153, 255)' },
    { id: 'image-0', role: VectorRole.Image, kind: VectorKind.Image, x: 0, y: 600, w: 400, h: 200 }
  ]
};

function setup(captureUi?: MotionToolDeps['captureUi']) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(async () => null), captureUi });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('recreate_ui from a url', () => {
  it('reads the live page into a vector UI component whose elements are addressable, and flags what stayed a picture', async () => {
    const captureUi = vi.fn(async () => ({ ok: true as const, ui: UI }));
    const { session, run } = setup(captureUi);

    const made = await run('recreate_ui', { url: 'https://feega.test/app', name: 'UiFeega', start: 0, duration: 3 });

    expect(captureUi).toHaveBeenCalledWith('https://feega.test/app');
    expect(made).toMatchObject({ ok: true, name: 'UiFeega', raster: ['image-0'] });
    expect(made.elements).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'input-0' }), expect.objectContaining({ id: 'button-0' })]));
    expect(made.anchors).toEqual(expect.arrayContaining(['input-0', 'button-0']));
    expect(findClip(session.doc, String(made.clip_id))?.clip.props.name).toBe('UiFeega');
  });

  it('says so when no browser is there to read the page', async () => {
    const { run } = setup();

    expect(await run('recreate_ui', { url: 'https://feega.test/app', name: 'UiFeega' })).toMatchObject({ ok: false });
  });
});

describe('the shot library', () => {
  it('list_shots names every shot with what it does, its slots, its length and a preview', async () => {
    const { run } = setup();

    const listed = (await run('list_shots', {})) as { shots: { id: string; about: string; slots: string[]; seconds: unknown; preview: string }[] };

    expect(listed.shots.map((s) => s.id)).toEqual(SHOT_IDS);
    expect(listed.shots.every((s) => s.about && s.preview.endsWith(`${s.id}.jpg`))).toBe(true);
  });

  it('add_shot places a premium shot built on the recreated UI', async () => {
    const { session, run } = setup(vi.fn(async () => ({ ok: true as const, ui: UI })));
    await run('recreate_ui', { url: 'https://feega.test/app', name: 'UiFeega' });

    const made = await run('add_shot', { shot: ShotId.UiFocus, ui: 'UiFeega', slots: { field_id: 'input-0', button_id: 'button-0', type_text: 'a launch film' }, at: 2 });

    expect(made).toMatchObject({ ok: true });
    expect(findClip(session.doc, String(made.clip_id))?.clip.props).toMatchObject({ field_id: 'input-0' });
  });

  it('the prompt sends a product trailer to the shots', () => {
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available })).toMatch(/add_shot/);
  });
});
