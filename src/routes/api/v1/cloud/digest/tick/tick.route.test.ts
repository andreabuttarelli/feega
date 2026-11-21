import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  commentsBetween: vi.fn(async () => [])
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$app/environment', () => ({ dev: false, browser: false }));
vi.mock('$lib/server/cloud/notify-db', () => ({ dbNotifyStore: { commentsBetween: mocks.commentsBetween } }));

import { GET } from './+server';

const call = (headers: Record<string, string> = {}) =>
  GET({ request: new Request('https://oh.feega.app/api/v1/cloud/digest/tick', { headers }), url: new URL('https://oh.feega.app/api/v1/cloud/digest/tick') } as never);

beforeEach(() => {
  mocks.commentsBetween.mockClear();
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.CRON_SECRET = 'cron';
});

describe('GET /api/v1/cloud/digest/tick', () => {
  it('refuses a caller without the cron secret', async () => {
    expect((await call()).status).toBe(401);
    expect(mocks.commentsBetween).not.toHaveBeenCalled();
  });

  it('runs the digest for the cron and reports what it did', async () => {
    const response = await call({ authorization: 'Bearer cron' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pushed: 0, emailed: 0, skipped: 0 });
    expect(mocks.commentsBetween).toHaveBeenCalledTimes(1);
  });
});
