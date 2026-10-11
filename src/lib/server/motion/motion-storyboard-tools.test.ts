import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { createMotionTools, type MotionSession, type StoryboardPort } from './motion-tools';

const BEAT = { act: 'problem', kind: 'scene', title: 'Folders', intent: 'the mess', emotion: 'tense', intensity: 0.4, duration: 3 };

function setup(storyboard?: StoryboardPort, pickAssets?: string[]) {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0, pickAssets };
  const assets = [
    { id: 'pic', kind: AssetKind.Image, label: 'pic', previewUrl: '', url: null },
    { id: 'clip', kind: AssetKind.Video, label: 'clip', previewUrl: '', url: null },
    { id: 'song', kind: AssetKind.Audio, label: 'song', previewUrl: '', url: null }
  ];
  const tools = createMotionTools({ session, assets, newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), storyboard });
  return (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
}

const port = (): StoryboardPort => ({
  write: vi.fn(async () => ({ canvasId: 'board', nodes: 3, connections: 1 })),
  read: vi.fn(async () => ({ canvasId: 'board', cards: [], media: [], flow: [] })),
  edit: vi.fn(async () => ({ ok: true as const })),
  link: vi.fn(async () => ({ ok: true as const }))
});

describe('storyboard tools', () => {
  it('writes the board with the kind of every picture and clip it hangs on a beat', async () => {
    const board = port();
    const run = setup(board);

    const out = await run('write_storyboard', { beats: [{ ...BEAT, media: ['pic', 'clip'] }] });

    expect(out).toMatchObject({ ok: true, canvas_id: 'board' });
    expect(board.write).toHaveBeenCalledWith(expect.objectContaining({ beats: [expect.objectContaining({ title: 'Folders' })] }), { pic: 'image', clip: 'video' });
  });

  it('refuses a board that leaves out a reference the user chose to follow', async () => {
    const board = port();
    const run = setup(board, ['pic', 'clip']);

    expect(await run('write_storyboard', { beats: [{ ...BEAT, media: ['pic'] }] })).toMatchObject({ ok: false, error: expect.stringContaining('clip') });
    expect(board.write).not.toHaveBeenCalled();
    expect(await run('write_storyboard', { beats: [{ ...BEAT, media: ['pic', 'clip'] }] })).toMatchObject({ ok: true });
  });

  it('refuses media that is not a picture or clip of this project', async () => {
    const board = port();
    const run = setup(board);

    expect(await run('write_storyboard', { beats: [{ ...BEAT, media: ['song'] }] })).toMatchObject({ ok: false });
    expect(await run('write_storyboard', { beats: [{ ...BEAT, media: ['nope'] }] })).toMatchObject({ ok: false });
    expect(board.write).not.toHaveBeenCalled();
  });

  it('reads the board back and edits a card', async () => {
    const board = port();
    const run = setup(board);

    expect(await run('read_storyboard', {})).toMatchObject({ ok: true, canvas_id: 'board', cards: [] });
    expect(await run('update_storyboard_card', { node_id: 'n', text: 'new' })).toMatchObject({ ok: true });
    expect(board.edit).toHaveBeenCalledWith('n', 'new');
  });

  it('says there is no storyboard yet', async () => {
    const board = { ...port(), read: vi.fn(async () => null) };
    const run = setup(board);

    expect(await run('read_storyboard', {})).toMatchObject({ ok: true, storyboard: null });
  });

  it('is unavailable without a store', async () => {
    const run = setup();

    expect(await run('read_storyboard', {})).toMatchObject({ ok: false });
  });

  it('links a card to clips that exist in the video', async () => {
    const board = port();
    const run = setup(board);
    const clip = await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'Hi' } });

    expect(await run('link_storyboard_beat', { node_id: 'n', clip_ids: ['nope'] })).toMatchObject({ ok: false });
    expect(board.link).not.toHaveBeenCalled();
    expect(await run('link_storyboard_beat', { node_id: 'n', clip_ids: [clip.clip_id] })).toMatchObject({ ok: true });
    expect(board.link).toHaveBeenCalledWith('n', [clip.clip_id]);
  });
});
