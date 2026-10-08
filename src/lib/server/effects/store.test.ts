import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { Outcome } from '$lib/server/repos/effects';
import { effectStore } from './store';
import type { GlPage } from './check';

const FRAG = 'vec4 effect(vec2 uv) { return texture2D(u_src, uv); }';
const actor = { kind: 'agent' as const, id: 'user-1', agentKey: 'motion' };

const row = (over: Record<string, unknown> = {}) => ({ id: 'fx-1', org_id: 'org-1', name: 'vhs', version: 2, frag: FRAG, params: [], check_state: 'unchecked', check_problems: [], cost_ms: null, deleted_at: null, updated_at: 'now', ...over });

const measured = { problems: [], costMs: 3, flicker: 0 };
const passing = () => ({ run: vi.fn(async () => measured) }) as unknown as GlPage & { run: ReturnType<typeof vi.fn> };

describe('effectStore.write', () => {
  it('creates a new effect, checks it in the GL page and records the verdict', async () => {
    const fake = fakeDb({ effects: [] }, { filter: true, updateRows: { effects: [{ id: 'generated-id', org_id: 'org-1', version: 1 }] } });
    const gl = passing();

    const out = await effectStore({ db: fake.db, orgId: 'org-1', actor, gl }).write({ name: 'glow', frag: FRAG, params: [] });

    expect(out.outcome).toBe(Outcome.Ok);
    expect(out.outcome === Outcome.Ok && out.effect.check.state).toBe('passed');
    expect(fake.calls.filter((c) => c.op === 'update').at(-1)?.payload).toMatchObject({ check_state: 'passed', cost_ms: 3 });
  });

  it('replaces an effect of the same name at its current version', async () => {
    const fake = fakeDb({ effects: [row()] }, { filter: true, mutate: true });

    const out = await effectStore({ db: fake.db, orgId: 'org-1', actor, gl: null }).write({ name: 'vhs', frag: FRAG.replace('uv)', 'uv * 0.5)'), params: [] });

    expect(out.outcome).toBe(Outcome.Ok);
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
    expect(fake.calls.find((c) => c.op === 'update')!.filters).toContainEqual(['version', 2]);
  });

  it('never sends an effect the lint refused to the GPU', async () => {
    const gl = passing();

    const out = await effectStore({ db: fakeDb({ effects: [] }, { filter: true }).db, orgId: 'org-1', actor, gl }).write({ name: 'loop', frag: 'vec4 effect(vec2 uv) { while (true) {} return vec4(0.0); }', params: [] });

    expect(out.outcome === Outcome.Ok && out.effect.check.state).toBe('failed');
    expect(gl.run).not.toHaveBeenCalled();
  });
});
