import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoreSink, type CoreBody } from '$lib/server/core-usage';

const read = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/stripe', () => ({ readStripeWebhook: read }));

const { POST } = await import('./+server');

const call = () => POST({ request: new Request('http://x/api/webhooks/stripe', { method: 'POST', body: '{}', headers: { 'stripe-signature': 's' } }) } as never);

afterEach(() => useCoreSink(null));

describe('POST /api/webhooks/stripe', () => {
  it('una firma non valida è 400 e non manda niente', async () => {
    read.mockReturnValue(null);

    expect((await call()).status).toBe(400);
  });

  it('una sottoscrizione feega arriva a PostHog sul gruppo dell org, con il piano sul gruppo', async () => {
    const sent: Omit<CoreBody, 'api_key'>[] = [];
    useCoreSink((b) => void sent.push(b));
    read.mockReturnValue({ type: 'customer.subscription.created', data: { object: { metadata: { app: 'feega', org_id: 'o1' }, items: { data: [{ quantity: 1, price: { unit_amount: 2000, currency: 'eur', lookup_key: 'pro' } }] } } } });

    expect((await call()).status).toBe(200);
    expect(sent.map((b) => b.event)).toEqual(['plan_upgraded', '$groupidentify']);
    expect(sent[0].properties).toMatchObject({ amount: 20, currency: 'eur', $groups: { organization: 'o1' } });
    expect(sent[1].properties).toMatchObject({ $group_set: { plan: 'pro' } });
  });
});
