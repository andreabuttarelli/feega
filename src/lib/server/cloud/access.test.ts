import { describe, expect, it, vi } from 'vitest';
import { CloudProvider, type TokenSet } from './cloud';
import { accessToken, type AccessDeps } from './access';

const NOW = 1_000_000;
const CREDS = { clientId: 'c', clientSecret: 's' };

function deps(over: Partial<AccessDeps> & { stored?: TokenSet | null; refreshed?: TokenSet | null } = {}): AccessDeps & { saved: TokenSet[] } {
  const saved: TokenSet[] = [];
  return {
    saved,
    credentials: over.credentials ?? (() => CREDS),
    read: over.read ?? (async () => over.stored ?? null),
    save: over.save ?? (async (_provider, tokens) => (saved.push(tokens), true)),
    refresh: over.refresh ?? (async (_provider, tokens, _creds, now) => (tokens.expiresAt > now ? tokens : (over.refreshed ?? null))),
    now: () => NOW
  };
}

describe('accessToken', () => {
  it('is not connected without stored tokens', async () => {
    expect(await accessToken(CloudProvider.Drive, deps())).toEqual({ ok: false, reason: 'not_connected' });
  });

  it('is not configured when the app has no client credentials', async () => {
    expect(await accessToken(CloudProvider.Drive, deps({ credentials: () => null }))).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('hands out a token that still has time', async () => {
    const d = deps({ stored: { accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 600_000 } });

    expect(await accessToken(CloudProvider.Drive, d)).toEqual({ ok: true, token: 'at' });
    expect(d.saved).toHaveLength(0);
  });

  it('refreshes an expired one and stores the new set', async () => {
    const next = { accessToken: 'new', refreshToken: 'rt', expiresAt: NOW + 3_600_000 };
    const d = deps({ stored: { accessToken: 'old', refreshToken: 'rt', expiresAt: NOW - 1 }, refreshed: next });

    expect(await accessToken(CloudProvider.Drive, d)).toEqual({ ok: true, token: 'new' });
    expect(d.saved).toEqual([next]);
  });

  it('asks to reconnect when the refresh is refused', async () => {
    const d = deps({ stored: { accessToken: 'old', refreshToken: 'rt', expiresAt: NOW - 1 } });

    expect(await accessToken(CloudProvider.Drive, d)).toEqual({ ok: false, reason: 'reconnect' });
  });
});

void vi;
