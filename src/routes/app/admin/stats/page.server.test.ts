import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

const source = vi.hoisted(() => ({
  weekly: vi.fn(),
  retention: vi.fn(),
  funnel: vi.fn(),
  signups: vi.fn()
}));
const adminEmails = vi.hoisted(() => ({ value: 'boss@feega.app, second@feega.app' as string | undefined }));

vi.mock('$lib/server/admin/stats-db', () => ({ statsDb: source }));
vi.mock('$env/dynamic/private', () => ({
  env: {
    get ADMIN_EMAILS() {
      return adminEmails.value;
    }
  }
}));

const FUNNEL = { installed: 12, opened: 11, started: 10, preview_ready: 8, first_edit: 5, signed_in: 3, multi_day: 2 };
const SIGNUPS = [{ week: '2026-11-16', total: 7, confirmed: 5 }];

const { load } = await import('./+page.server');

const run = (user: { email: string } | null) => (load as any)({ locals: { safeGetSession: async () => ({ session: user ? {} : null, user }) } });

beforeEach(() => {
  adminEmails.value = 'boss@feega.app, second@feega.app';
  source.weekly.mockReset().mockResolvedValue([{ week: '2026-11-16', editor: 'cursor', installs: 4 }]);
  source.retention.mockReset().mockResolvedValue([{ cohort: '2026-11-02', installs: 10, w1: 5, w2: 3, w4: 2, w8: 0 }]);
  source.funnel.mockReset().mockResolvedValue(FUNNEL);
  source.signups.mockReset().mockResolvedValue(SIGNUPS);
});

describe('admin stats page', () => {
  it('shows the four blocks to an admin', async () => {
    const data = await run({ email: 'Second@Feega.app' });

    expect(data.weekly).toEqual([{ week: '2026-11-16', editor: 'cursor', installs: 4 }]);
    expect(data.retention[0]).toMatchObject({ cohort: '2026-11-02', installs: 10, w1: 50, w2: 30, w4: 20, w8: 0 });
    expect(data.funnel).toEqual(FUNNEL);
    expect(data.signups).toEqual(SIGNUPS);
  });

  it('answers 404 to a signed-in user who is not an admin', async () => {
    const error = await run({ email: 'someone@else.com' }).catch((e: unknown) => e);

    expect(isHttpError(error, 404)).toBe(true);
    expect(source.weekly).not.toHaveBeenCalled();
  });

  it('answers 404 to everyone when no allowlist is set', async () => {
    adminEmails.value = undefined;

    const error = await run({ email: 'boss@feega.app' }).catch((e: unknown) => e);

    expect(isHttpError(error, 404)).toBe(true);
  });

  it('sends a signed-out visitor to login', async () => {
    const error = await run(null).catch((e: unknown) => e);

    expect(isRedirect(error)).toBe(true);
    expect((error as { location: string }).location).toBe('/login');
  });
});
