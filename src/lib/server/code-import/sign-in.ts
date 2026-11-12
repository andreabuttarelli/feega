import { appBrowse, DEFAULT_PASSWORD_SELECTOR, NO_SESSION, onLoginPage, signInPath, type AppAccount, type AppAccountStore } from '$lib/server/web/app-browse';
import type { AppSession, AppTab, OpenAppBrowser } from '$lib/server/web/browser';

const PASSWORD_PROBE_MS = 500;

export type TestAccount = { loginUrl: string; email: string; password: string };

export enum Gate {
  None = 'none',
  Failed = 'failed',
  Signed = 'signed'
}

export type SignIn = { gate: Gate.None } | { gate: Gate.Failed; loginUrl: string; error: string } | { gate: Gate.Signed; loginUrl: string; session: AppSession };

export enum Locked {
  NoAccount = 'needs sign-in: add a TEST account in project settings so the import can sign in',
  SignInFailed = 'needs sign-in: signing in with the test account failed',
  StillLocked = 'needs sign-in: the test account signed in, but this route still went to the sign-in page'
}

export type LockedRoute = { label: string; reason: Locked; detail?: string };

const LOCKED: Record<Gate, Locked> = {
  [Gate.None]: Locked.NoAccount,
  [Gate.Failed]: Locked.SignInFailed,
  [Gate.Signed]: Locked.StillLocked
};

const pathOf = (url: string) => (URL.canParse(url) ? new URL(url).pathname.replace(/\/+$/, '') : url);

export function loginOn(loginUrl: string, appUrl: string): string {
  const login = new URL(loginUrl);
  return new URL(`${login.pathname}${login.search}`, appUrl).href;
}

function memoryOf(account: AppAccount): AppAccountStore & { kept: () => AppAccount } {
  let kept = account;
  return {
    kept: () => kept,
    read: async () => kept,
    save: async (next) => {
      kept = next;
    },
    forget: async () => undefined
  };
}

export async function signedIn(open: OpenAppBrowser, account: TestAccount | null, appUrl: string, sleep?: (ms: number) => Promise<unknown>): Promise<SignIn> {
  if (!account) {
    return { gate: Gate.None };
  }

  const loginUrl = loginOn(account.loginUrl, appUrl);
  const memory = memoryOf({ loginUrl, email: account.email, password: account.password, session: NO_SESSION, sessionUntil: null });
  const done = await appBrowse({}, { open, accounts: memory, sleep });
  if (!done.ok) {
    return { gate: Gate.Failed, loginUrl, error: done.error.split(account.password).join('[password]') };
  }
  return { gate: Gate.Signed, loginUrl, session: memory.kept().session };
}

export async function lockedOut(tab: AppTab, requested: string, loginUrl: string | null): Promise<boolean> {
  const landed = tab.url();
  if (pathOf(landed) === pathOf(requested)) {
    return false;
  }
  if (loginUrl ? onLoginPage(landed, loginUrl) : signInPath(landed)) {
    return true;
  }
  return tab.waitFor(DEFAULT_PASSWORD_SELECTOR, PASSWORD_PROBE_MS).then(
    () => true,
    () => false
  );
}

export function lockedRoute(label: string, sign: SignIn): LockedRoute {
  return { label, reason: LOCKED[sign.gate], ...(sign.gate === Gate.Failed ? { detail: sign.error } : {}) };
}
