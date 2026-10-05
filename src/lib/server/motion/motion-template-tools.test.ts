import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';

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
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing })).toContain('insert_template');
  });
});

function withLibrary() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const save = vi.fn(async () => ({ ok: true as const, entry: { id: 'saved-1', template: BUILTIN_TEMPLATES[0].template } }));
  const templates = { list: async () => BUILTIN_TEMPLATES, save, remove: async () => false };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), templates });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run, save };
}

describe('motion agent template library tools', () => {
  it('list_templates names each template with its typed fields', async () => {
    const { run } = withLibrary();

    const listed = (await run('list_templates', {})) as unknown as { templates: { id: string; fields: { key: string }[] }[] };

    expect(listed.templates.find((t) => t.id === 'builtin:lower-third')?.fields.map((f) => f.key)).toEqual(['name', 'role', 'accent']);
  });

  it('insert_template places a locked precomp; set_template_fields fills it, checked against its schema', async () => {
    const { run, session } = withLibrary();

    const placed = await run('insert_template', { template_id: 'builtin:lower-third', start: 1 });
    const clip = String(placed.clip_id);

    expect(placed).toMatchObject({ ok: true, fields: expect.arrayContaining([expect.objectContaining({ key: 'name' })]) });
    expect((await run('set_template_fields', { clip_id: clip, values: { name: 'Grace Hopper' } })).ok).toBe(true);
    expect(await run('set_template_fields', { clip_id: clip, values: { accent: 'red' } })).toMatchObject({ ok: false, error: expect.stringMatching(/accent expects a #rrggbb/) });
    expect(await run('set_template_fields', { clip_id: clip, values: { nope: 'x' } })).toMatchObject({ ok: false, error: expect.stringMatching(/no field nope/) });
    expect(JSON.stringify(session.doc)).toContain('Grace Hopper');
  });

  it('edit_comp refuses a template until detach_template unlocks it', async () => {
    const { run, session } = withLibrary();
    const clip = String((await run('insert_template', { template_id: 'builtin:quote', start: 0 })).clip_id);
    const comp = String(session.doc.tracks[0].clips[0].props.comp);

    expect(await run('edit_comp', { comp, calls: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/detach/) });
    expect((await run('detach_template', { clip_id: clip })).ok).toBe(true);
    expect((await run('edit_comp', { comp, calls: [] })).ok).toBe(true);
  });

  it('save_template stores the whole video or a precomp in the library', async () => {
    const { run, save } = withLibrary();
    await run('add_clip', { component: 'Title', start: 0, duration: 2 });
    await run('expose_field', { key: 'headline', label: 'Headline', type: 'text', clip_id: 'id1', prop: 'text' });

    expect(await run('save_template', { name: 'Promo' })).toMatchObject({ ok: true, template_id: 'saved-1' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ compId: null, meta: { name: 'Promo', description: '' } }));
  });
});
