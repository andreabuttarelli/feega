import { describe, expect, it, vi } from 'vitest';
import { disconnect } from './disconnect';
import { CloudProvider } from './cloud';

const TOKENS = { accessToken: 'at', refreshToken: 'rt', expiresAt: 1 };

function deps(stored: typeof TOKENS | null, revoked = true) {
  return { read: vi.fn(async () => stored), remove: vi.fn(async () => undefined), revoke: vi.fn(async () => revoked) };
}

describe('disconnecting a cloud provider', () => {
  it('revokes at Google with the refresh token, then forgets the tokens', async () => {
    const d = deps(TOKENS);

    await disconnect(CloudProvider.Drive, d);

    expect(d.revoke).toHaveBeenCalledWith(CloudProvider.Drive, 'rt');
    expect(d.remove).toHaveBeenCalledWith(CloudProvider.Drive);
  });

  it('revokes at Dropbox with the access token', async () => {
    const d = deps(TOKENS);

    await disconnect(CloudProvider.Dropbox, d);

    expect(d.revoke).toHaveBeenCalledWith(CloudProvider.Dropbox, 'at');
  });

  it('forgets the tokens even when the provider will not revoke', async () => {
    const d = deps(TOKENS, false);

    const out = await disconnect(CloudProvider.Drive, d);

    expect(d.remove).toHaveBeenCalled();
    expect(out).toEqual({ revoked: false });
  });

  it('with nothing stored it calls no provider', async () => {
    const d = deps(null);

    await disconnect(CloudProvider.Drive, d);

    expect(d.revoke).not.toHaveBeenCalled();
    expect(d.remove).toHaveBeenCalled();
  });
});
