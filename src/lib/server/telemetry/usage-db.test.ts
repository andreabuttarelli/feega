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

    await makeSink(insert)([row(), row({ event: 'preview_ready' }), row({ event: 'install' }), row({ event: 'sign_in' }), row({ event: 'opened' })]);

    const retried = insert.mock.calls[1][0];
    expect(retried).toHaveLength(1);
    expect(retried[0]).not.toHaveProperty('framework');
    expect(retried[0]).not.toHaveProperty('edit_kind');
    expect(retried[0]).not.toHaveProperty('signed_in');
  });

  it('throws other errors', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '500' } });

    await expect(makeSink(insert)([row()])).rejects.toMatchObject({ code: '500' });
  });
});
