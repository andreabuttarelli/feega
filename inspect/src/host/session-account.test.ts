import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AccountState, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { accountOfBody, memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { inspectSession } from './session';

const jwt = `h.${Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@b.co' })).toString('base64url')}.s`;
const tokens = { access_token: jwt, refresh_token: 'r', expires_at: 99 };
const accounts = (sent: ViewMessage[]) => sent.filter((m) => m.kind === ToView.Account).map((m) => (m as Extract<ViewMessage, { kind: ToView.Account }>).state);

function setup() {
  const sent: ViewMessage[] = [];
  const toasts: string[] = [];
  const opened: string[] = [];
  let handle: (m: HostMessage) => unknown = () => undefined;
  const stored = new Map<string, unknown>();
  const account = memoryAccountStore();
  const platform = {
    version: '1',
    launcher: '',
    send: (m: ViewMessage) => sent.push(m),
    receive: (h: typeof handle) => void (handle = h),
    settings: () => ({}),
    stored: (key: string) => stored.get(key),
    store: async (key: string, value: unknown) => void stored.set(key, value),
    log: () => undefined,
    openExternal: (url: string) => opened.push(url),
    notify: (text: string) => toasts.push(text),
    warn: async () => false,
    account,
    onboarding: memoryOnboardingStore()
  } as unknown as Platform;
  inspectSession(platform, mkdtempSync(join(tmpdir(), 'feega-acc-')));
  const send = (m: HostMessage) => handle(m);
  const post = async (state: string) => {
    const url = new URL(opened[opened.length - 1]);
    return fetch(`http://127.0.0.1:${url.searchParams.get('cli_port')}/session`, { method: 'POST', body: JSON.stringify({ ...tokens, state }) });
  };
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { sent, toasts, opened, account, send, post, until };
}

describe('account nella sessione', () => {
  it('al ready dice signed out se non c e una sessione', async () => {
    const t = setup();
    t.send({ kind: ToHost.Ready });
    await t.until(() => accounts(t.sent).length > 0);
    expect(t.sent.find((m) => m.kind === ToView.Account)).toEqual({ kind: ToView.Account, state: AccountState.SignedOut });
  });

  it('al ready mostra l email della sessione salvata', async () => {
    const t = setup();
    await t.account.write(accountOfBody(tokens)!);
    t.send({ kind: ToHost.Ready });
    await t.until(() => accounts(t.sent).length > 0);
    expect(t.sent.find((m) => m.kind === ToView.Account)).toEqual({ kind: ToView.Account, state: AccountState.SignedIn, email: 'a@b.co' });
  });

  it('sign in apre il browser, attende, salva e avvisa', async () => {
    const t = setup();
    t.send({ kind: ToHost.SignIn });
    await t.until(() => t.opened.length > 0);
    expect(accounts(t.sent)).toEqual([AccountState.Waiting]);
    const state = new URL(t.opened[0]).searchParams.get('cli_state')!;
    await t.post(state);
    await t.until(() => t.toasts.length > 0);
    expect(accounts(t.sent)).toEqual([AccountState.Waiting, AccountState.SignedIn]);
    expect((await t.account.read())?.user.email).toBe('a@b.co');
    expect(t.toasts).toEqual(['Signed in as a@b.co']);
  });

  it('con uno state sbagliato non salva nulla', async () => {
    const t = setup();
    t.send({ kind: ToHost.SignIn });
    await t.until(() => t.opened.length > 0);
    expect((await t.post('evil')).status).toBe(400);
    expect(await t.account.read()).toBeNull();
    t.send({ kind: ToHost.CancelSignIn });
  });

  it('annullare mostra lo stato cancelled', async () => {
    const t = setup();
    t.send({ kind: ToHost.SignIn });
    await t.until(() => t.opened.length > 0);
    t.send({ kind: ToHost.CancelSignIn });
    await t.until(() => accounts(t.sent).length > 1);
    expect(accounts(t.sent)).toEqual([AccountState.Waiting, AccountState.Cancelled]);
    expect(await t.account.read()).toBeNull();
  });

  it('sign out cancella la sessione', async () => {
    const t = setup();
    await t.account.write(accountOfBody(tokens)!);
    t.send({ kind: ToHost.SignOut });
    await t.until(() => accounts(t.sent).length > 0);
    expect(await t.account.read()).toBeNull();
    expect(accounts(t.sent)).toEqual([AccountState.SignedOut]);
  });
});
