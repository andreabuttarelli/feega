import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const UPLOADED = [{ family: 'House Serif', variants: [{ assetId: 'hs-r', weight: 400, italic: false }, { assetId: 'hs-b', weight: 700, italic: false }] }];

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), fonts: async () => UPLOADED });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent font tools', () => {
  it('list_fonts searches the whole Google catalogue with weights and italics', async () => {
    const { run } = setup();
    const out = (await run('list_fonts', { query: 'playfair' })) as { fonts: { family: string; weights: number[]; italic: boolean }[] };

    expect(out.fonts[0]).toMatchObject({ family: 'Playfair Display', italic: true });
    expect(out.fonts[0].weights).toContain(700);
  });

  it('set_font sets family, weight and italic on a text clip and shows the font in the doc; remove_font refuses while used', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });

    expect((await run('set_font', { clip_id: 'id1', family: 'Playfair Display', weight: 700, italic: true })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.props).toMatchObject({ font: 'Playfair Display', weight: 700, italic: true });
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"family":"Playfair Display"');
    expect(String((await run('remove_font', { family: 'Playfair Display' })).error)).toContain('id1');

    await run('set_font', { clip_id: 'id1', family: 'sans' });
    expect((await run('remove_font', { family: 'Playfair Display' })).ok).toBe(true);
    expect(session.doc.fonts).toEqual([]);
  });

  it('register_font makes a family available to custom component font params', async () => {
    const { session, run } = setup();
    expect((await run('register_font', { family: 'Space Grotesk' })).ok).toBe(true);
    expect(session.doc.fonts.map((f) => f.family)).toEqual(['Space Grotesk']);
    expect(String((await run('register_font', { family: 'Not A Real Font Zzz' })).error)).toContain('no Google font');
  });

  it('list_fonts shows the org uploaded fonts first, and set_font and register_font use them by name', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    const listed = (await run('list_fonts', { query: 'house' })) as { uploaded: { family: string; weights: number[] }[] };

    expect(listed.uploaded).toEqual([{ family: 'House Serif', weights: [400, 700], italic: false }]);
    expect((await run('set_font', { clip_id: 'id1', family: 'house serif', weight: 700 })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.props).toMatchObject({ font: 'House Serif', weight: 700 });
    expect(session.doc.fonts[0]).toMatchObject({ family: 'House Serif', source: 'upload', variants: UPLOADED[0].variants });
    expect((await run('register_font', { family: 'House Serif' })).ok).toBe(true);
    expect(session.doc.fonts).toHaveLength(1);
  });

  it('the prompt teaches fonts', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    for (const needle of ['set_font', 'list_fonts', 'register_font']) {
      expect(prompt).toContain(needle);
    }
  });
});
