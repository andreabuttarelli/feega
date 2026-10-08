import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { fakeDb } from '$lib/server/db/fake-db';
import { effectStore } from '$lib/server/effects/store';
import { createMotionTools, type MotionSession } from './motion-tools';

const FRAG = 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(c.rgb * u_amount, 1.0); }';
const AMOUNT = { key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 };
const stored = { id: 'eff-1', org_id: 'org-1', name: 'dim', version: 1, frag: FRAG, params: [AMOUNT], check_state: 'passed', check_problems: [], cost_ms: 2, deleted_at: null, updated_at: 'now' };

function setup(rows: unknown[] = [stored]) {
  let n = 0;
  const fake = fakeDb({ effects: rows }, { filter: true, mutate: true });
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const effects = effectStore({ db: fake.db, orgId: 'org-1', actor: { kind: 'agent', id: 'user-1', agentKey: 'motion' }, gl: null });
  const tools = createMotionTools({ session, assets: [{ id: 'a1', kind: 'image', label: 'pic', previewUrl: '', url: 'https://x/a.png' }] as never, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), effects });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { run, session, fake };
}

describe('custom effect tools of the motion agent', () => {
  it('write_effect stores the effect for the workspace and returns its check', async () => {
    const { run, fake } = setup([]);

    const out = await run('write_effect', { name: 'glow', frag: FRAG, params: [AMOUNT] });

    expect(out).toMatchObject({ ok: true, name: 'glow', check: { state: 'unchecked' } });
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', actor_kind: 'agent', agent_key: 'motion' });
  });

  it('write_effect hands lint problems back as data, so the model can retry', async () => {
    const { run } = setup([]);

    const out = await run('write_effect', { name: 'loop', frag: 'vec4 effect(vec2 uv) { while (true) {} return vec4(0.0); }', params: [] });

    expect(out).toMatchObject({ ok: false, check: { state: 'failed' } });
    expect(String(out.error)).toMatch(/while/);
  });

  it('patch_effect answers conflict on a stale version', async () => {
    const { run } = setup();

    expect(await run('patch_effect', { effect_id: 'eff-1', version: 9, edits: [{ find: 'u_amount', replace: '0.5' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/conflict/) });
  });

  it('list_effects shows name, params, state and cost', async () => {
    const { run } = setup();

    expect(await run('list_effects', {})).toMatchObject({ effects: [{ effect_id: 'eff-1', name: 'dim', state: 'passed', cost_ms: 2 }] });
  });

  it('a written effect goes on a clip and the doc still validates', async () => {
    const { run, session } = setup();
    const clip = (await run('add_clip', { component: 'Image', start: 0, duration: 2, props: { assetId: 'a1' } })) as { clip_id: string };

    const out = await run('add_custom_effect', { clip_id: clip.clip_id, effect_id: 'eff-1', params: { amount: 0.5 } });

    expect(out).toMatchObject({ ok: true, animate: [expect.stringMatching(/^fx\.id\d+\.amount$/)] });
    expect(parseMotionDoc(JSON.parse(JSON.stringify(session.doc))).ok).toBe(true);
    expect(session.doc.shaders['eff-1'].frag).toBe(FRAG);
  });

  it('stops writing effects after three failed tries in one turn', async () => {
    const { run } = setup([]);
    const bad = { name: 'bad', frag: 'vec4 effect(vec2 uv) { while (true) {} return vec4(0.0); }', params: [] };

    for (let i = 0; i < 3; i++) {
      await run('write_effect', bad);
    }

    expect(await run('write_effect', bad)).toMatchObject({ ok: false, error: expect.stringMatching(/three/) });
  });
});
