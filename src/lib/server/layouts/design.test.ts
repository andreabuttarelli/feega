import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { Outcome } from '$lib/server/repos/effects';
import { designLayout, type LayoutAsk } from './design';

vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));

const SPEC = { kind: 'spec', slots: 8, place: { kind: 'ring', radius: 3 }, animate: [{ prop: 'y', amp: 0.3, freq: 1, phase: { index: 1 } }] };
const scope = { orgId: 'org-1', userId: 'user-1' };

describe('designLayout', () => {
  it('turns a prompt into a stored spec layout in one model call', async () => {
    const fake = fakeDb({ layouts: [] }, { filter: true });
    const ask: LayoutAsk = vi.fn(async () => ({ name: 'orbit', spec: SPEC }));

    const out = await designLayout(fake.db, scope, 'cards orbiting slowly', ask);

    expect(out.outcome).toBe(Outcome.Ok);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', name: 'orbit', actor_kind: 'agent', agent_key: 'compose' });
  });

  it('hands the problems back once and stores the fixed spec', async () => {
    const fake = fakeDb({ layouts: [] }, { filter: true });
    const ask = vi.fn<LayoutAsk>().mockResolvedValueOnce({ name: 'orbit', spec: { ...SPEC, place: { kind: 'spiral' } } }).mockResolvedValueOnce({ name: 'orbit', spec: SPEC });

    const out = await designLayout(fake.db, scope, 'cards orbiting', ask);

    expect(out.outcome).toBe(Outcome.Ok);
    expect(ask.mock.calls[1][0]).toMatch(/place/);
  });

  it('gives up after the retry with the problems', async () => {
    const ask: LayoutAsk = vi.fn(async () => ({ name: 'orbit', spec: { kind: 'spec' } }));

    const out = await designLayout(fakeDb({ layouts: [] }, { filter: true }).db, scope, 'x', ask);

    expect(out.outcome).toBe(Outcome.Invalid);
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
