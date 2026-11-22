import { describe, expect, it, vi } from 'vitest';
import { ProductEvent, track, type EventRow } from '$lib/server/product-events/track';
import { useCoreSink } from '$lib/server/core-usage';

describe('track', () => {
  it('writes one row with the ids and the props, never more', async () => {
    const rows: EventRow[] = [];
    await track(ProductEvent.AgentConnected, { userId: 'u1', orgId: 'o1' }, { key_id: 'k1' }, async (row) => void rows.push(row));

    expect(rows).toEqual([{ event: 'agent_connected', user_id: 'u1', org_id: 'o1', anonymous_id: null, props: { key_id: 'k1' } }]);
  });

  it('a signed-out visitor is recorded by the anonymous id alone', async () => {
    const rows: EventRow[] = [];
    await track(ProductEvent.TeamInviteAccepted, { anonymousId: 'n1' }, { role: 'editor' }, async (row) => void rows.push(row));

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

describe('track verso PostHog', () => {
  it("un evento con l'utente arriva anche a PostHog, con il gruppo dell'org", async () => {
    const sent: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];
    useCoreSink((body) => void sent.push(body));

    await track(ProductEvent.TeamInviteSent, { userId: 'u1', orgId: 'o1' }, { role: 'editor', via: 'email' }, async () => {});
    useCoreSink(null);

    expect(sent).toMatchObject([{ event: 'team_invite_sent', distinct_id: 'u1', properties: { role: 'editor', $groups: { organization: 'o1' } } }]);
  });

  it('un visitatore anonimo resta solo nella tabella', async () => {
    const sent: unknown[] = [];
    useCoreSink((body) => void sent.push(body));

    await track(ProductEvent.SignupCompleted, { anonymousId: 'n1' }, {}, async () => {});
    useCoreSink(null);

    expect(sent).toEqual([]);
  });
});
