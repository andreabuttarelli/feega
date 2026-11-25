import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

const source = vi.hoisted(() => ({
  weekly: vi.fn(),
  retention: vi.fn(),
  funnel: vi.fn(),
  signups: vi.fn(),
  active: vi.fn(),
  onboarding: vi.fn(),
  features: vi.fn(),
  agents: vi.fn(),
  errors: vi.fn(),
  frameworks: vi.fn(),
  surfaces: vi.fn(),
  diffs: vi.fn(),
  editDims: vi.fn()
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

const FUNNEL = [{ step: 'first_seen', installs: 20 }, { step: 'project_detected', installs: 10 }, { step: 'first_edit', installs: 5 }, { step: 'returned_7d', installs: 1 }];
const SIGNUPS = [{ week: '2026-11-16', total: 7, confirmed: 5 }];

const { load } = await import('./+page.server');

const run = (user: { email: string } | null) => (load as any)({ locals: { safeGetSession: async () => ({ session: user ? {} : null, user }) } });

beforeEach(() => {
  adminEmails.value = 'boss@feega.app, second@feega.app';
  source.weekly.mockReset().mockResolvedValue([{ week: '2026-11-16', editor: 'cursor', installs: 4 }]);
  source.retention.mockReset().mockResolvedValue([{ cohort: '2026-11-02', installs: 10, w1: 5, w2: 3, w4: 2, w8: 0 }]);
  source.funnel.mockReset().mockResolvedValue(FUNNEL);
  source.signups.mockReset().mockResolvedValue(SIGNUPS);
  source.active.mockReset().mockResolvedValue({ day: [{ period: '2026-11-24', installs: 18, signed_in: 4, anonymous: 14 }], week: [{ period: '2026-11-23', installs: 22, signed_in: 5, anonymous: 17 }] });
  source.onboarding.mockReset().mockResolvedValue([]);
  source.features.mockReset().mockResolvedValue([{ event: 'library_insert', events: 7, installs: 3 }]);
  source.agents.mockReset().mockResolvedValue([]);
  source.errors.mockReset().mockResolvedValue([]);
  source.frameworks.mockReset().mockResolvedValue([{ framework: 'next', styling: 'tailwind', installs: 6 }]);
  source.surfaces.mockReset().mockResolvedValue([]);
  source.diffs.mockReset().mockResolvedValue([{ day: '2026-11-24', diffs: 40, manual: 30, ai: 10, reverted: 4, lines_added: 90, lines_removed: 30 }]);
  source.editDims.mockReset().mockResolvedValue([{ dim: 'prop_category', value: 'spacing', diffs: 12 }, { dim: 'prop_category', value: 'color', diffs: 30 }, { dim: 'target', value: 'text', diffs: 5 }]);
});

describe('admin stats page', () => {
  it('shows the four blocks to an admin', async () => {
    const data = await run({ email: 'Second@Feega.app' });

    expect(data.weekly).toEqual([{ week: '2026-11-16', editor: 'cursor', installs: 4 }]);
    expect(data.retention[0]).toMatchObject({ cohort: '2026-11-02', installs: 10, w1: 50, w2: 30, w4: 20, w8: 0 });
    expect(data.funnel).toEqual([{ step: 'first_seen', installs: 20, percent: 100 }, { step: 'project_detected', installs: 10, percent: 50 }, { step: 'first_edit', installs: 5, percent: 25 }, { step: 'returned_7d', installs: 1, percent: 5 }]);
    expect(data.signups).toEqual(SIGNUPS);
  });

  it('counts active installs on any event, split anonymous and signed in', async () => {
    const data = await run({ email: 'boss@feega.app' });

    expect(data.active.day[0]).toEqual({ period: '2026-11-24', installs: 18, signed_in: 4, anonymous: 14 });
    expect(data.active.week[0].installs).toBe(22);
  });

  it('derives revert rate and manual versus AI share per day', async () => {
    const data = await run({ email: 'boss@feega.app' });

    expect(data.diffs[0]).toMatchObject({ day: '2026-11-24', diffs: 40, revertRate: 10, aiShare: 25 });
  });

  it('ranks property categories by diffs', async () => {
    const data = await run({ email: 'boss@feega.app' });

    expect(data.editDims.prop_category.map((row: { value: string }) => row.value)).toEqual(['color', 'spacing']);
    expect(data.editDims.target).toEqual([{ value: 'text', diffs: 5 }]);
  });

  it('still shows the page when the new telemetry views are not migrated yet', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    source.features.mockRejectedValue(new Error('function does not exist'));
    source.active.mockRejectedValue(new Error('function does not exist'));

    const data = await run({ email: 'boss@feega.app' });

    expect(data.features).toBeNull();
    expect(data.active).toBeNull();
    expect(data.signups).toEqual(SIGNUPS);
    log.mockRestore();
  });

  it('lo shows the other blocks when one fails and logs the failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    source.signups.mockRejectedValue(new Error('permission denied for table users'));

    const data = await run({ email: 'boss@feega.app' });

    expect(data.signups).toBeNull();
    expect(data.weekly).toHaveLength(1);
    expect(data.retention).toHaveLength(1);
    expect(data.funnel).toHaveLength(4);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
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
