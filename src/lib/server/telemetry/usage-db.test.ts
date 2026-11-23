import { describe, expect, it, vi } from 'vitest';
import { makeSink } from './usage-db';
import type { UsageRow } from './usage';

const row = (extra: Partial<UsageRow> = {}): UsageRow => ({
  event: 'edit',
  install_id: '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10',
  session_id: '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77',
  ext_version: '0.3.0',
  editor: 'cursor',
  os: 'linux',
  arch: 'x64',
  device: 'desktop',
  edit_count: 1,
  duration_ms: null,
  country: null,
  region: null,
  city: null,
  framework: 'next',
  edit_kind: 'text',
  signed_in: true,
  step: null,
  tier: null,
  ...extra
});

describe('usage sink', () => {
  it('inserts the full rows when the table has the funnel columns', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });

    await makeSink(insert)([row()]);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0][0]).toMatchObject({ framework: 'next', edit_kind: 'text', signed_in: true });
  });

  it('retries without the funnel columns and new events when the table lacks them', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: 'PGRST204' } }).mockResolvedValueOnce({ error: null });

    await makeSink(insert)([row(), row({ event: 'preview_ready' }), row({ event: 'install' }), row({ event: 'sign_in' }), row({ event: 'opened' }), row({ event: 'library_insert', tier: 'pro' })]);

    const retried = insert.mock.calls[1][0];
    expect(retried).toHaveLength(1);
    expect(retried[0]).not.toHaveProperty('framework');
    expect(retried[0]).not.toHaveProperty('edit_kind');
    expect(retried[0]).not.toHaveProperty('signed_in');
    expect(retried[0]).not.toHaveProperty('step');
    expect(retried[0]).not.toHaveProperty('tier');
  });

  it('keeps the other funnel events when only the support action is not accepted yet', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: '23514' } }).mockResolvedValueOnce({ error: null });

    await makeSink(insert)([row({ event: 'install' }), row({ event: 'support_action', item: 'star' }), row({ event: 'onboarding_step', step: 'support' })]);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0].map((r: UsageRow) => r.event)).toEqual(['install', 'onboarding_step']);
    expect(insert.mock.calls[1][0].every((r: UsageRow) => !('item' in r))).toBe(true);
  });

  it('falls back to the legacy rows when the support retry still lacks columns', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: '42703' } }).mockResolvedValueOnce({ error: { code: '42703' } }).mockResolvedValueOnce({ error: null });

    await makeSink(insert)([row(), row({ event: 'support_action', item: 'star' })]);

    expect(insert.mock.calls[2][0].map((r: UsageRow) => r.event)).toEqual(['edit']);
  });

  it('throws other errors', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '500' } });

    await expect(makeSink(insert)([row()])).rejects.toMatchObject({ code: '500' });
  });
});
