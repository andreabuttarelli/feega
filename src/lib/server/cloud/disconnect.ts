import { revocableToken, type CloudProvider, type TokenSet } from './cloud';

export type DisconnectDeps = {
  read: (provider: CloudProvider) => Promise<TokenSet | null>;
  remove: (provider: CloudProvider) => Promise<void>;
  revoke: (provider: CloudProvider, token: string) => Promise<boolean>;
};

export async function disconnect(provider: CloudProvider, deps: DisconnectDeps): Promise<{ revoked: boolean }> {
  const stored = await deps.read(provider);
  const token = stored ? revocableToken(provider, stored) : null;
  const revoked = token ? await deps.revoke(provider, token) : false;
  await deps.remove(provider);
  return { revoked };
}
