import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

const onboardingPathFor = vi.fn();
vi.mock('$lib/server/onboarding/onboarding', async (orig) => ({
  ...(await orig<object>()),
  onboardingPathFor: (...args: unknown[]) => onboardingPathFor(...args)
}));

const { load } = await import('./+page.server');

const SESSION = { access_token: 'a', refresh_token: 'r', expires_at: 1 };

function run() {
  const url = new URL('https://oh.feega.app/cli/callback?cli_port=4000&cli_state=s1');
  return (load as any)({
    url,
    cookies: { get: () => undefined },
    locals: { safeGetSession: async () => ({ session: SESSION, user: { id: 'u1', email: 'a@b.co' } }), db: async () => ({}) }
  });
}

describe('cli callback load', () => {
  it('detours through onboarding and comes back to the same callback', async () => {
    onboardingPathFor.mockResolvedValueOnce('/onboarding?next=x');

    const error = await run().catch((e: unknown) => e);

    expect(isRedirect(error)).toBe(true);
    expect(onboardingPathFor).toHaveBeenCalledWith(expect.anything(), expect.anything(), null, '/cli/callback?cli_port=4000&cli_state=s1');
  });

  it('hands the tokens to the editor once onboarding is done', async () => {
    onboardingPathFor.mockResolvedValueOnce(null);

    await expect(run()).resolves.toMatchObject({ cliPort: '4000', cliState: 's1' });
  });
});
