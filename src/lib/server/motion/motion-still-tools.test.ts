import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { ImageFormat, ImageScale } from '$lib/motion/still-model';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup(extra: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Portrait), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...extra });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('the motion agent makes still graphics', () => {
  it('set_canvas with still pins a frame, and get_motion_doc shows it in seconds', async () => {
    const { run, session } = setup();

    expect(await run('set_canvas', { format: MotionFormat.Poster, still: 2 })).toMatchObject({ ok: true });
    expect(session.doc).toMatchObject({ width: 1080, height: 1527, still: { frame: 60 } });
    expect(await run('get_motion_doc', {})).toMatchObject({ still: { time: 2 } });
  });

  it('set_canvas with still false makes it a video again', async () => {
    const { run, session } = setup();
    await run('set_canvas', { still: 1 });

    await run('set_canvas', { still: false });

    expect(session.doc.still).toBeUndefined();
  });

  it('export_image draws the doc being edited at full size and returns the file url', async () => {
    const exportStill = vi.fn(async () => ({ ok: true as const, asset_id: 'a1', url: 'https://files/a1.png', width: 2160, height: 2700 }));
    const { run, session } = setup({ exportStill });
    await run('set_canvas', { still: 1 });

    const out = await run('export_image', { format: ImageFormat.Png, scale: ImageScale.Two });

    expect(out).toMatchObject({ ok: true, url: 'https://files/a1.png', width: 2160 });
    expect(exportStill).toHaveBeenCalledWith(session.doc, expect.objectContaining({ format: ImageFormat.Png, scale: ImageScale.Two, mime: 'image/png' }));
  });

  it('export_image of a video draws the time asked for', async () => {
    const exportStill = vi.fn(async () => ({ ok: true as const, asset_id: 'a1', url: 'u', width: 1080, height: 1350 }));
    const { run } = setup({ exportStill });

    await run('export_image', { format: ImageFormat.Jpg, time: 3 });

    expect(exportStill).toHaveBeenCalledWith(expect.objectContaining({ still: { frame: 90 } }), expect.objectContaining({ format: ImageFormat.Jpg, scale: ImageScale.One }));
  });

  it('export_image says so when nothing here can draw', async () => {
    const { run } = setup();

    expect(await run('export_image', { format: ImageFormat.Png })).toMatchObject({ ok: false });
  });
});
