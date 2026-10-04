import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const batch = vi.fn(async () => ({ ok: true, batchId: 'b1', rows: 2, credits: 12 }));
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), batch });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run, batch };
}

async function withField() {
  const s = setup();
  await s.run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'Hello' } });
  await s.run('expose_field', { key: 'headline', label: 'Headline', type: 'text', clip_id: 'id1', prop: 'text' });
  return s;
}

describe('motion agent template tools', () => {
  it('expose_field names a clip prop; list_fields shows it with its value; get_motion_doc shows fields', async () => {
    const { run } = await withField();

    expect(await run('list_fields', {})).toEqual({ fields: [expect.objectContaining({ key: 'headline', clipId: 'id1', prop: 'text', value: 'Hello', missing: false })] });
    expect(JSON.stringify(await run('get_motion_doc', {}))).toContain('"fields":[');
  });

  it('unexpose_field removes it', async () => {
    const { run, session } = await withField();

    expect((await run('unexpose_field', { key: 'headline' })).ok).toBe(true);
    expect(session.doc.fields).toEqual([]);
  });

  it('render_batch without confirm only quotes: rows, credits, and asks to confirm with the user', async () => {
    const { run, batch } = await withField();

    const quoted = await run('render_batch', { rows: [{ headline: 'A' }, { headline: 'B' }], confirm: false });

    expect(quoted).toMatchObject({ ok: false, needs_confirmation: true, rows: 2, credits: expect.any(Number) });
    expect(batch).not.toHaveBeenCalled();
  });

  it('render_batch with confirm renders every row through the farm', async () => {
    const { run, batch } = await withField();

    expect(await run('render_batch', { rows: [{ headline: 'A' }, { headline: 'B' }], name_pattern: '{{n}}-{{headline}}', confirm: true })).toMatchObject({ ok: true, batchId: 'b1' });
    expect(batch).toHaveBeenCalledWith(expect.objectContaining({ rows: [{ name: '001-A', values: { headline: 'A' } }, { name: '002-B', values: { headline: 'B' } }] }));
  });

  it('a row with a value of the wrong type is refused before any quote', async () => {
    const { run } = await withField();
    await run('expose_field', { key: 'size', label: 'Size', type: 'number', clip_id: 'id1', prop: 'size' });

    expect(await run('render_batch', { rows: [{ size: 'big' }], confirm: false })).toEqual({ ok: false, error: 'row 1: size expects a number, got "big"' });
  });

  it('the prompt mentions templates and batches', () => {
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing })).toContain('render_batch');
  });
});
