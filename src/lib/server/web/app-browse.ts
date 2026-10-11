import { z } from 'zod';
import { RequestVerdict, requestVerdict } from './screenshot';
import { BROWSE_MAX_STEPS, browseStepSchema, walkSteps, type BrowseStep, type StepReport } from './browse';
import type { AppSession, AppTab, Target, UiDigest } from './browser';

export const APP_MAX_PAGES = 6;
export const APP_MAX_SHOTS = 6;
export const APP_DEADLINE_MS = 60_000;
export const APP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_FIELD_WAIT_MS = 10_000;
const LOGIN_SETTLE_MS = 2_500;
const PAGE_SETTLE_MS = 1_500;

export const DEFAULT_EMAIL_SELECTOR = 'input[type="email"], input[name="email"], input[name="username"], input[autocomplete="username"], input[autocomplete="email"]';
export const DEFAULT_PASSWORD_SELECTOR = 'input[type="password"]';
export const DEFAULT_SUBMIT_SELECTOR = 'form:has(input[type="password"]) button[type="submit"], form:has(input[type="password"]) input[type="submit"], form:has(input[type="password"]) button[name="submit"]';

export const LOGIN_BLOCKED_PLATFORMS: readonly { label: string; hosts: readonly string[] }[] = [
  { label: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'messenger.com'] },
  { label: 'Threads', hosts: ['threads.net', 'threads.com'] },
  { label: 'TikTok', hosts: ['tiktok.com'] },
  { label: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in'] },
  { label: 'X / Twitter', hosts: ['x.com', 'twitter.com'] },
  { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { label: 'Google', hosts: ['google.com', 'gmail.com'] },
  { label: 'Reddit', hosts: ['reddit.com'] },
  { label: 'Pinterest', hosts: ['pinterest.com'] },
  { label: 'Snapchat', hosts: ['snapchat.com'] },
  { label: 'WhatsApp', hosts: ['whatsapp.com', 'wa.me'] },
  { label: 'Telegram', hosts: ['telegram.org', 't.me'] },
  { label: 'Amazon', hosts: ['amazon.com', 'amazon.co.uk', 'amazon.it', 'amazon.de', 'amazon.es', 'amazon.fr'] }
];

export const DESTRUCTIVE_WORDS: readonly string[] = ['delete', 'remove', 'destroy', 'erase', 'archive', 'pay', 'purchase', 'buy', 'checkout', 'subscribe', 'upgrade', 'invite', 'send', 'transfer', 'revoke', 'elimina', 'rimuovi', 'cancella', 'paga', 'acquista', 'compra', 'abbonati', 'invita', 'invia'];

export enum Confirm {
  No = 'no',
  Yes = 'yes'
}

export enum SessionUse {
  Reused = 'reused',
  Fresh = 'fresh'
}

export type AppAccount = { loginUrl: string; email: string; password: string; session: AppSession; sessionUntil: number | null };

export const NO_SESSION: AppSession = { cookies: [], storage: {} };

export type AppAccountStore = {
  read: () => Promise<AppAccount | null>;
  save: (account: AppAccount) => Promise<void>;
  forget: () => Promise<void>;
};

export type AppBrowsePorts = { open: () => Promise<AppTab>; accounts: AppAccountStore; now?: () => number; sleep?: (ms: number) => Promise<unknown> };

export const appBrowseInputSchema = z.object({
  login_url: z.string().url().max(2000).optional(),
  email: z.string().min(1).max(320).optional(),
  password: z.string().min(1).max(200).optional(),
  pages: z.array(z.string().min(1).max(2000)).max(APP_MAX_PAGES).optional(),
  steps: z.array(browseStepSchema).max(BROWSE_MAX_STEPS).optional(),
  confirmed: z.boolean().optional()
});

export type AppBrowseInput = z.infer<typeof appBrowseInputSchema>;

export type AppPage = { url: string; ok: true; shot: number; ui: UiDigest } | { url: string; ok: false; error: string };

export type AppBrowseOutcome =
  | { ok: true; url: string; session: SessionUse; pages: AppPage[]; steps: StepReport[]; shots: Buffer[]; ui?: UiDigest; costUsd: number; stopped?: string }
  | { ok: false; error: string; shots: Buffer[]; costUsd: number };

export const NO_ACCOUNT = 'no app account for this project yet: ask the user for a TEST account (login url, email, password) of the app, saying the AI will see these credentials, so they must be test credentials, never a real account';

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const hostOf = (url: string) => (URL.canParse(url) ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : null);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function destructiveWord(label: string): string | null {
  const words = label.toLowerCase().split(/[^\p{L}]+/u);
  return DESTRUCTIVE_WORDS.find((w) => words.includes(w)) ?? null;
}

export function blockedPlatform(url: string): string | null {
  const host = hostOf(url);
  if (!host) {
    return null;
  }
  return LOGIN_BLOCKED_PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.label ?? null;
}

export const sameApp = (url: string, app: string) => hostOf(url) !== null && hostOf(url) === hostOf(app);

export function signInPath(url: string): boolean {
  if (!URL.canParse(url)) {
    return false;
  }
  const path = new URL(url).pathname.replace(/\/+$/, '').toLowerCase();
  return /(^|\/)(log-?in|sign-?in|sign-?up)(\/|$)/.test(path);
}

export function onLoginPage(pageUrl: string, loginUrl: string): boolean {
  if (!URL.canParse(pageUrl)) {
    return false;
  }
  const bare = (u: string) => {
    const p = new URL(u);
    return `${p.origin}${p.pathname.replace(/\/+$/, '')}`.toLowerCase();
  };
  return signInPath(pageUrl) || bare(pageUrl) === bare(loginUrl);
}

export type KeptSession = { session: AppSession; origin: string };

export function savedSession(accounts: AppAccountStore, now: () => number = Date.now): (url: string) => Promise<KeptSession | null> {
  return async (url) => {
    const account = await accounts.read();
    if (!account || !account.sessionUntil || account.sessionUntil <= now() || !sameApp(url, account.loginUrl)) {
      return null;
    }
    return { session: account.session, origin: new URL(account.loginUrl).origin };
  };
}

function pageUrl(page: string, loginUrl: string): string {
  const url = new URL(page, loginUrl).href;
  if (!sameApp(url, loginUrl)) {
    throw new Error(`only pages of ${hostOf(loginUrl)} can be opened with this account`);
  }
  return url;
}

async function accountOf(input: AppBrowseInput, stored: AppAccount | null): Promise<AppAccount | string> {
  const given = { loginUrl: input.login_url ?? stored?.loginUrl, email: input.email ?? stored?.email, password: input.password ?? stored?.password };
  if (!given.loginUrl || !given.email || !given.password) {
    return NO_ACCOUNT;
  }
  const blocked = blockedPlatform(given.loginUrl);
  if (blocked) {
    return `signing in to ${blocked} with a browser breaks its terms: app_browse is only for the user's own app`;
  }
  if ((await requestVerdict(given.loginUrl)) === RequestVerdict.Abort) {
    return `${given.loginUrl} is not a public web page`;
  }
  const same = stored && stored.loginUrl === given.loginUrl && stored.email === given.email && stored.password === given.password;
  return same ? stored : { loginUrl: given.loginUrl, email: given.email, password: given.password, session: NO_SESSION, sessionUntil: null };
}

function fenced(tab: AppTab, app: string, confirm: Confirm): AppTab {
  return {
    ...tab,
    goto: (url) => {
      if (!sameApp(url, app)) {
        throw new Error(`only pages of ${hostOf(app)} can be opened with this account`);
      }
      return tab.goto(url);
    },
    click: async (target: Target) => {
      const word = destructiveWord(`${target.text ?? ''} ${await tab.label(target)}`);
      if (word && confirm === Confirm.No) {
        throw new Error(`"${word}" may change, send or pay for something: ask the user to confirm in chat, then call again with confirmed: true`);
      }
      return tab.click(target);
    }
  };
}

async function signIn(tab: AppTab, account: AppAccount, sleep: (ms: number) => Promise<unknown>): Promise<boolean> {
  await tab.goto(account.loginUrl);
  await tab.waitFor(DEFAULT_EMAIL_SELECTOR, LOGIN_FIELD_WAIT_MS).catch(() => undefined);
  await tab.type(DEFAULT_EMAIL_SELECTOR, account.email);
  await tab.type(DEFAULT_PASSWORD_SELECTOR, account.password);
  await tab.click({ selector: DEFAULT_SUBMIT_SELECTOR });
  await sleep(LOGIN_SETTLE_MS);
  return !onLoginPage(tab.url(), account.loginUrl);
}

async function resumed(tab: AppTab, account: AppAccount, first: string, now: number): Promise<boolean> {
  const kept = account.session.cookies.length + Object.keys(account.session.storage).length;
  if (!kept || !account.sessionUntil || account.sessionUntil <= now) {
    return false;
  }
  await tab.restore(account.session, new URL(account.loginUrl).origin);
  await tab.goto(first);
  return !onLoginPage(tab.url(), account.loginUrl);
}

const hidden = (message: string, account: AppAccount) => message.split(account.password).join('[password]');

async function visit(tab: AppTab, url: string, shots: Buffer[], sleep: (ms: number) => Promise<unknown>): Promise<AppPage> {
  try {
    await tab.goto(url);
    await sleep(PAGE_SETTLE_MS);
    shots.push(await tab.shot());
    return { url: tab.url(), ok: true, shot: shots.length - 1, ui: await tab.ui() };
  } catch (e) {
    return { url, ok: false, error: errorOf(e) };
  }
}

export async function appBrowse(input: AppBrowseInput, ports: AppBrowsePorts): Promise<AppBrowseOutcome> {
  const now = ports.now ?? Date.now;
  const sleep = ports.sleep ?? pause;
  const account = await accountOf(input, await ports.accounts.read());
  if (typeof account === 'string') {
    return { ok: false, error: account, shots: [], costUsd: 0 };
  }
  await ports.accounts.save(account);

  let opened: AppTab;
  try {
    opened = await ports.open();
  } catch (e) {
    return { ok: false, error: `the browser could not open: ${errorOf(e)}`, shots: [], costUsd: 0 };
  }

  const deadline = now() + APP_DEADLINE_MS;
  const tab = fenced(opened, account.loginUrl, input.confirmed ? Confirm.Yes : Confirm.No);
  const shots: Buffer[] = [];
  const close = () => opened.close().catch(() => 0);

  const wanted = (input.pages ?? []).slice(0, APP_MAX_PAGES);
  const first = wanted.find((p) => URL.canParse(p, account.loginUrl) && sameApp(new URL(p, account.loginUrl).href, account.loginUrl));
  const landing = new URL(first ?? '/', account.loginUrl).href;

  try {
    const session = (await resumed(opened, account, landing, now())) ? SessionUse.Reused : SessionUse.Fresh;
    if (session === SessionUse.Fresh && !(await signIn(opened, account, sleep))) {
      shots.push(await opened.shot());
      await ports.accounts.save({ ...account, session: NO_SESSION, sessionUntil: null });
      return { ok: false, error: `login failed: still on the sign-in page (${opened.url()}). Look at the picture: a wrong test account, a captcha or a two-step login`, shots, costUsd: await close() };
    }
    await ports.accounts.save({ ...account, session: await opened.session(), sessionUntil: now() + APP_SESSION_TTL_MS });

    const pages: AppPage[] = [];
    for (const page of wanted) {
      if (now() > deadline) {
        break;
      }
      const url = (() => {
        try {
          return pageUrl(page, account.loginUrl);
        } catch (e) {
          return e as Error;
        }
      })();
      pages.push(url instanceof Error ? { url: page, ok: false, error: url.message } : await visit(tab, url, shots, sleep));
    }

    const steps: BrowseStep[] = input.steps ?? [];
    const walked = await walkSteps(tab, steps, deadline, APP_MAX_SHOTS - shots.length);
    shots.push(...walked.shots);
    const ui = walked.shots.length ? await opened.ui().catch(() => undefined) : undefined;
    await ports.accounts.save({ ...account, session: await opened.session(), sessionUntil: now() + APP_SESSION_TTL_MS });

    return { ok: true, url: opened.url(), session, pages, steps: walked.steps, shots, ...(ui ? { ui } : {}), costUsd: await close(), ...(walked.stopped ? { stopped: walked.stopped } : {}) };
  } catch (e) {
    return { ok: false, error: hidden(errorOf(e), account), shots, costUsd: await close() };
  }
}
