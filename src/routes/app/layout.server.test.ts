import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

const onboardingPathFor = vi.fn();
vi.mock('$lib/server/onboarding/onboarding', async (orig) => ({
  ...(await orig<object>()),
  onboardingPathFor: (...args: unknown[]) => onboardingPathFor(...args)
}));

const { load } = await import('./+layout.server');

function run(path: string, user: object | null) {
  const url = new URL(`https://oh.feega.app${path}`);
  return (load as any)({
    url,
    cookies: { get: () => undefined },
    locals: { safeGetSession: async () => ({ session: user ? {} : null, user }), db: async () => ({}) }
  });
}

async function target(path: string, user: object | null) {
  try {
    await run(path, user);
  } catch (error) {
    if (isRedirect(error)) {
      return error.location;
    }
    throw error;
  }
  return null;
}

beforeEach(() => onboardingPathFor.mockReset());

describe('app layout onboarding gate', () => {
  it('sends a user who still needs onboarding there, keeping the path', async () => {
    onboardingPathFor.mockResolvedValueOnce('/onboarding?next=%2Fapp%2Fsettings%2Fprofile');

    await expect(target('/app/settings/profile', { id: 'u1' })).resolves.toBe('/onboarding?next=%2Fapp%2Fsettings%2Fprofile');
    expect(onboardingPathFor).toHaveBeenCalledWith(expect.anything(), expect.anything(), null, '/app/settings/profile');
  });

  it('lets a finished account through', async () => {
    onboardingPathFor.mockResolvedValueOnce(null);

    await expect(target('/app', { id: 'u1' })).resolves.toBeNull();
  });

  it('leaves a signed-out visitor to the existing behaviour', async () => {
    await expect(target('/app', null)).resolves.toBeNull();
    expect(onboardingPathFor).not.toHaveBeenCalled();
  });
});
