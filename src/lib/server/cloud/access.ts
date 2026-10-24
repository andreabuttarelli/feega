import type { CloudProvider, Credentials, TokenSet } from './cloud';

export type AccessDeps = {
  credentials: (provider: CloudProvider) => Credentials | null;
  read: (provider: CloudProvider) => Promise<TokenSet | null>;
  save: (provider: CloudProvider, tokens: TokenSet) => Promise<boolean>;
  refresh: (provider: CloudProvider, tokens: TokenSet, creds: Credentials, now: number) => Promise<TokenSet | null>;
  now: () => number;
};

export type Access = { ok: true; token: string } | { ok: false; reason: 'not_configured' | 'not_connected' | 'reconnect' };

export async function accessToken(provider: CloudProvider, deps: AccessDeps): Promise<Access> {
  const creds = deps.credentials(provider);
  if (!creds) {
    return { ok: false, reason: 'not_configured' };
  }
  const stored = await deps.read(provider);
  if (!stored) {
    return { ok: false, reason: 'not_connected' };
  }

  const current = await deps.refresh(provider, stored, creds, deps.now());
  if (!current) {
    return { ok: false, reason: 'reconnect' };
  }
  if (current !== stored) {
    await deps.save(provider, current);
  }
  return { ok: true, token: current.accessToken };
}
