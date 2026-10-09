import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { createMotionTools, type MotionSession, type StoryboardPort } from './motion-tools';

const BEAT = { act: 'problem', kind: 'scene', title: 'Folders', intent: 'the mess', emotion: 'tense', intensity: 0.4, duration: 3 };

function setup(storyboard?: StoryboardPort) {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
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
  edit: vi.fn(async () => ({ ok: true as const }))
});

describe('storyboard tools', () => {
  it('writes the board with the kind of every picture and clip it hangs on a beat', async () => {
    const board = port();
    const run = setup(board);

    const out = await run('write_storyboard', { beats: [{ ...BEAT, media: ['pic', 'clip'] }] });

    expect(out).toMatchObject({ ok: true, canvas_id: 'board' });
    expect(board.write).toHaveBeenCalledWith(expect.objectContaining({ beats: [expect.objectContaining({ title: 'Folders' })] }), { pic: 'image', clip: 'video' });
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
});
