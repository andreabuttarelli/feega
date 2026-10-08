import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { fakeDb } from '$lib/server/db/fake-db';
import { layoutStore } from '$lib/server/layouts/store';
import { createMotionTools, type MotionSession } from './motion-tools';

const SPEC = { kind: 'spec', slots: 6, place: { kind: 'ring', radius: 3 } };
const stored = { id: 'lay-1', org_id: 'org-1', name: 'orbit', version: 1, kind: 'spec', spec: SPEC, deleted_at: null, updated_at: 'now' };

function setup(rows: unknown[] = [stored]) {
  let n = 0;
  const fake = fakeDb({ layouts: rows }, { filter: true, mutate: true });
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const layouts = layoutStore({ db: fake.db, orgId: 'org-1', actor: { kind: 'agent', id: 'user-1', agentKey: 'motion' } });
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), layouts });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { run, session, fake };
}

describe('custom layout tools of the motion agent', () => {
  it('write_layout stores a spec layout for the workspace', async () => {
    const { run, fake } = setup([]);

    expect(await run('write_layout', { name: 'orbit', spec: SPEC })).toMatchObject({ ok: true, layout_id: expect.any(String), name: 'orbit' });
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', agent_key: 'motion' });
  });

  it('write_layout hands spec problems back as data', async () => {
    const { run } = setup([]);

    expect(await run('write_layout', { name: 'bad', spec: { ...SPEC, place: { kind: 'spiral' } } })).toMatchObject({ ok: false, error: expect.stringMatching(/invalid/) });
  });

  it('list_layouts shows the workspace layouts', async () => {
    const { run } = setup();

    expect(await run('list_layouts', {})).toMatchObject({ layouts: [{ layout_id: 'lay-1', name: 'orbit', version: 1 }] });
  });

  it('apply_layout puts a custom layout on a composition clip and the doc validates', async () => {
    const { run, session } = setup();
    const clip = (await run('add_clip', { component: 'Composition', start: 0, duration: 2 })) as { clip_id: string };

    expect(await run('apply_layout', { clip_id: clip.clip_id, layout_id: 'lay-1' })).toMatchObject({ ok: true });
    const props = session.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.clip_id)!.props as Record<string, unknown>;
    expect(props).toMatchObject({ layout: 'custom', layoutRef: 'lay-1', layoutSpec: { kind: 'spec', name: 'orbit' } });
    expect(parseMotionDoc(JSON.parse(JSON.stringify(session.doc))).ok).toBe(true);
  });

  it('patch_layout answers conflict on a stale version', async () => {
    const { run } = setup();

    expect(await run('patch_layout', { layout_id: 'lay-1', version: 5, spec: SPEC })).toMatchObject({ ok: false, error: expect.stringMatching(/conflict/) });
  });
});
