import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageRow } from '$lib/server/telemetry/usage';

const stored = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('$lib/server/telemetry/usage-db', () => ({
  dbSink: async (rows: unknown[]) => {
    stored.rows.push(...rows);
  }
}));

import { POST } from './+server';

const body = {
  events: [{ event: 'edit', install_id: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10', session_id: '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77', ext_version: '0.2.9', editor: 'cursor', os: 'linux', arch: 'x64', device: 'desktop', edit_count: 3 }]
};

describe('POST /api/v1/telemetry', () => {
  beforeEach(() => {
    stored.rows = [];
  });

  it('records an anonymous batch without any session', async () => {
    const request = new Request('https://oh.feega.app/api/v1/telemetry', { method: 'POST', body: JSON.stringify(body), headers: { 'x-vercel-ip-country': 'DE', 'x-vercel-ip-city': 'Berlin' } });
    const res = await POST({ request, getClientAddress: () => 'route-test-client' } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(204);
    expect(stored.rows as UsageRow[]).toMatchObject([{ event: 'edit', editor: 'cursor', country: 'DE', city: 'Berlin', edit_count: 3 }]);
  });

  it('accepts funnel fields and rejects unknown ones', async () => {
    const send = (extra: object) =>
      POST({
        request: new Request('https://oh.feega.app/api/v1/telemetry', { method: 'POST', body: JSON.stringify({ events: [{ ...body.events[0], ...extra }] }) }),
        getClientAddress: () => `funnel-${Math.random()}`
      } as Parameters<typeof POST>[0]);

    expect((await send({ edit_kind: 'style', framework: 'sveltekit', signed_in: false })).status).toBe(204);
    expect(stored.rows).toMatchObject([{ edit_kind: 'style', framework: 'sveltekit', signed_in: false }]);
    expect((await send({ event: 'preview_ready' })).status).toBe(204);
    expect((await send({ edit_kind: 'bogus' })).status).toBe(400);
    expect((await send({ framework: 'not a framework' })).status).toBe(400);
  });

  it.each(['install', 'opened', 'sign_in', 'sign_out', 'session_resume'])('accepts the account event %s', async (event) => {
    const request = new Request('https://oh.feega.app/api/v1/telemetry', { method: 'POST', body: JSON.stringify({ events: [{ ...body.events[0], event }] }) });
    const res = await POST({ request, getClientAddress: () => `route-test-${event}` } as Parameters<typeof POST>[0]);

    expect(res.status).toBe(204);
    expect(stored.rows as UsageRow[]).toMatchObject([{ event }]);
  });

  const post = (extra: object) => POST({ request: new Request('https://oh.feega.app/api/v1/telemetry', { method: 'POST', body: JSON.stringify({ events: [{ ...body.events[0], ...extra }] }) }), getClientAddress: () => `route-test-${JSON.stringify(extra)}` } as Parameters<typeof POST>[0]);

  it.each(['onboarding_started', 'onboarding_finished', 'onboarding_skipped', 'setup_applied', 'setup_failed', 'skill_hint_shown', 'skill_installed', 'plugin_installed'])('accepts the lifecycle event %s', async (event) => {
    expect((await post({ event })).status).toBe(204);
    expect(stored.rows as UsageRow[]).toMatchObject([{ event, step: null, tier: null }]);
  });

  it('stores the onboarding step and the library tier', async () => {
    await post({ event: 'onboarding_step', step: 'sign_in' });
    await post({ event: 'library_insert', tier: 'pro' });

    expect(stored.rows as UsageRow[]).toMatchObject([{ event: 'onboarding_step', step: 'sign_in' }, { event: 'library_insert', tier: 'pro' }]);
  });

  it('rejects a step or tier outside the known ids', async () => {
    expect((await post({ event: 'onboarding_step', step: 'free text' })).status).toBe(400);
    expect((await post({ event: 'library_insert', tier: 'a-secret-item' })).status).toBe(400);
  });
});
