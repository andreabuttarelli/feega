import { describe, expect, it, vi } from 'vitest';
import { ProductEvent, track, type EventRow } from '$lib/server/product-events/track';

describe('track', () => {
  it('writes one row with the ids and the props, never more', async () => {
    const rows: EventRow[] = [];
    await track(ProductEvent.AgentFailed, { userId: 'u1', orgId: 'o1' }, { code: 'project_not_found' }, async (row) => void rows.push(row));

    expect(rows).toEqual([{ event: 'agent_failed', user_id: 'u1', org_id: 'o1', anonymous_id: null, props: { code: 'project_not_found' } }]);
  });

  it('a signed-out visitor is recorded by the anonymous id alone', async () => {
    const rows: EventRow[] = [];
    await track(ProductEvent.LandingPromptSent, { anonymousId: 'n1' }, { kind: 'motion', source: null }, async (row) => void rows.push(row));

    expect(rows[0]).toMatchObject({ user_id: null, org_id: null, anonymous_id: 'n1' });
  });

  it('a missing table logs and lets the request go on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(track(ProductEvent.SignupCompleted, { userId: 'u1' }, {}, async () => ({ error: { message: 'relation "product_events" does not exist' } }))).resolves.toBeUndefined();
    await expect(track(ProductEvent.SignupCompleted, { userId: 'u1' }, {}, async () => { throw new Error('down'); })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
