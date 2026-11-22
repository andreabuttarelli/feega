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
});
