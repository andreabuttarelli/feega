import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Account = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } };

export type AccountStore = {
  read: () => Promise<Account | null>;
  write: (account: Account) => Promise<unknown>;
  clear: () => Promise<unknown>;
};

const CLI_SESSION = join('.config', 'feega', 'session.json');
const SECONDS_PER_HOUR = 3600;
const MS_PER_SECOND = 1000;

export const cliSessionPath = (home: string = homedir()) => join(home, CLI_SESSION);

function claimsOf(token: unknown): { sub?: string; email?: string } | null {
  const payload = typeof token === 'string' ? token.split('.')[1] : undefined;
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function accountOfBody(body: Record<string, unknown>): Account | null {
  const claims = claimsOf(body.access_token);
  if (!claims?.sub || !claims.email || typeof body.refresh_token !== 'string') {
    return null;
  }
  const expires = Number(body.expires_at) || Math.floor(Date.now() / 1000) + SECONDS_PER_HOUR;
  return { access_token: body.access_token as string, refresh_token: body.refresh_token, expires_at: expires, user: { id: claims.sub, email: claims.email } };
}

export async function accountToken(store: AccountStore, nowSeconds: number = Math.floor(Date.now() / MS_PER_SECOND)): Promise<string | null> {
  const account = await store.read();

  return account && account.expires_at > nowSeconds ? account.access_token : null;
}

export const memoryAccountStore = (): AccountStore => {
  let held: Account | null = null;
  return { read: async () => held, write: async (account) => void (held = account), clear: async () => void (held = null) };
};

export const fileAccountStore = (path: string = cliSessionPath()): AccountStore => ({
  read: async () => {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8')) as Account;
      return stored.refresh_token && stored.user?.email ? stored : null;
    } catch {
      return null;
    }
  },
  write: async (account) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(account, null, 2), { mode: 0o600 });
  },
  clear: async () => rmSync(path, { force: true })
});
