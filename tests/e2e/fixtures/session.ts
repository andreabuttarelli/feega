import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { purgeStorage, type StoragePort } from './storage-purge';
import { E2eTarget, TEST_ACCOUNT_EMAIL, assertTestAccount, refuseAdminWrites, targetOf } from '../../../scripts/e2e/target';

/**
 * LA SESSIONE USA-E-GETTA CHE OGNI SPEC `@real` COSTRUISCE SOPRA. Stesso pattern di
 * `scripts/eval/canvas.ts` e `scripts/eval/gen-node.ts` (service role per seminare
 * org/progetto/tela, teardown SEMPRE in `finally`): non è codice applicativo, quindi non passa
 * da `createServiceRoleDb` e non serve una voce in `service-role-uses.ts`.
 *
 * IL LOGIN È QUELLO VERO: si compila il form su `/login` e si aspetta il redirect, non si
 * inietta un cookie fatto a mano. È più lento di un bypass, ma prova che `hooks.server.ts` legge
 * davvero la sessione che Supabase ha scritto — un bypass che salta quel codice non lo esercita.
 */
export type E2eSession = {
  userId: string;
  email: string;
  password: string;
  orgId: string;
  projectId: string;
  canvasId: string;
  canvasName: string;
  target: E2eTarget;
};

/** Abbondante per qualunque scenario reale della suite: una generazione di testo costa ~14 crediti. */
export const E2E_ORG_CREDITS = 5000;

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };

function supabaseUrl(): string {
  const url = process.env.PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('E2E_REAL_STACK=1 richiede PUBLIC_SUPABASE_URL');
  }
  return url;
}

export function e2eTarget(): E2eTarget {
  return targetOf(supabaseUrl());
}

const signedClients = new Map<string, Promise<{ db: SupabaseClient; userId: string }>>();

function userClient(email: string, password: string): Promise<{ db: SupabaseClient; userId: string }> {
  const signed = signedClients.get(email) ?? signInClient(email, password);
  signedClients.set(email, signed);
  signed.catch(() => signedClients.delete(email));
  return signed;
}

async function signInClient(email: string, password: string): Promise<{ db: SupabaseClient; userId: string }> {
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('E2E_REAL_STACK=1 richiede PUBLIC_SUPABASE_ANON_KEY');
  }
  const db = createClient(supabaseUrl(), anonKey, CLIENT_OPTIONS);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.user) {
    throw new Error(`e2e sign-in failed: ${signed.error?.message ?? 'no user'}`);
  }
  assertTestAccount(e2eTarget(), signed.data.user.email);
  return { db, userId: signed.data.user.id };
}

function adminClient(): SupabaseClient {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('E2E_REAL_STACK=1 richiede PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY veri');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function checked<T>(result: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const response = await result;
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data;
}

/**
 * `withCredits: false` è per l'unica spec che prova il rifiuto del cancello — il saldo zero è il
 * caso da provare in QUELLO scenario, non un default che ogni altra spec deve aggirare.
 */
export enum E2eTour {
  Seen = 'seen',
  Due = 'due'
}

export const TOUR_SEEN_KEY = 'feega:tour-seen';

type SessionOptions = { withCredits?: boolean; tour?: E2eTour };

export async function createE2eSession(opts: SessionOptions = {}): Promise<E2eSession> {
  return LIFECYCLE[e2eTarget()].create(opts);
}

export async function teardownE2eSession(session: E2eSession): Promise<void> {
  await LIFECYCLE[session.target].teardown(session);
}

function testAccountCredentials(): { email: string; password: string } {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('e2e on production needs E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
  }
  assertTestAccount(E2eTarget.Production, email);
  return { email, password };
}

async function createInTestAccount(opts: SessionOptions): Promise<E2eSession> {
  if (opts.withCredits === false) {
    throw new Error(`a zero-credit org cannot be staged on ${TEST_ACCOUNT_EMAIL}`);
  }
  const { email, password } = testAccountCredentials();
  const { db, userId } = await userClient(email, password);

  const membership = await checked(db.from('orgs_members').select('org_id').eq('user_id', userId).eq('role', 'owner').limit(1).single());
  const orgId = membership?.org_id;
  if (!orgId) {
    throw new Error(`${email} owns no org`);
  }
  const projectId = randomUUID();
  const canvasId = randomUUID();
  const canvasName = 'Prima tela';

  const tourSeenAt = (opts.tour ?? E2eTour.Seen) === E2eTour.Seen ? new Date().toISOString() : null;
  await checked(db.from('profiles').update({ onboarding_seen_at: tourSeenAt }).eq('id', userId));
  await checked(db.from('projects').insert({ id: projectId, org_id: orgId, name: 'E2E project', slug: `e2e-project-${projectId}` }));
  await checked(db.from('canvases').insert({ id: canvasId, org_id: orgId, project_id: projectId, name: canvasName }));

  return { userId, email, password, orgId, projectId, canvasId, canvasName, target: E2eTarget.Production };
}

const PROJECT_ROWS = ['assets', 'chat_threads', 'nodes', 'canvases'] as const;
const CANVAS_BUCKET = 'canvas-assets';

async function teardownInTestAccount(session: E2eSession): Promise<void> {
  const { db, userId } = await userClient(session.email, session.password);

  await purgeStorage(fixedBuckets(db, [CANVAS_BUCKET]), [`${session.orgId}/${session.projectId}`]);
  for (const table of PROJECT_ROWS) {
    await checked(db.from(table).delete().eq('project_id', session.projectId));
  }
  await checked(db.from('projects').delete().eq('id', session.projectId));
  await checked(db.from('profiles').update({ onboarding_seen_at: new Date().toISOString() }).eq('id', userId));
}

async function createDisposable(opts: SessionOptions): Promise<E2eSession> {
  refuseAdminWrites(e2eTarget());
  const db = adminClient();
  const email = `e2e-shell-${randomUUID()}@feega.app`;
  const password = randomUUID();

  const created = await checked(db.auth.admin.createUser({ email, password, email_confirm: true }));
  if (!created.user) {
    throw new Error('e2e fixture: createUser non ha restituito un utente');
  }
  const userId = created.user.id;

  const orgId = randomUUID();
  const projectId = randomUUID();
  const canvasId = randomUUID();
  const canvasName = 'Prima tela';

  await checked(db.from('profiles').upsert({ id: userId, email, name: 'E2E shell' }));
  if ((opts.tour ?? E2eTour.Seen) === E2eTour.Seen) {
    await db.from('profiles').update({ onboarding_seen_at: new Date().toISOString() }).eq('id', userId);
  }
  await checked(db.from('orgs').insert({ id: orgId, name: 'E2E shell', slug: `e2e-shell-${orgId}` }));
  await checked(db.from('orgs_members').insert({ org_id: orgId, user_id: userId, role: 'owner' }));
  await checked(db.from('projects').insert({ id: projectId, org_id: orgId, name: 'E2E project', slug: `e2e-project-${projectId}` }));
  await checked(db.from('canvases').insert({ id: canvasId, org_id: orgId, project_id: projectId, name: canvasName }));

  if (opts.withCredits ?? true) {
    // Senza un grant la generazione reale si ferma al cancello crediti (org_credit_balance = 0):
    // la spec di fumo prova la generazione, non il portafoglio vuoto.
    await checked(
      db.from('credit_ledger').insert({
        org_id: orgId,
        kind: 'grant',
        source: 'manual',
        amount: E2E_ORG_CREDITS,
        note: 'e2e fixture grant'
      })
    );
  }

  return { userId, email, password, orgId, projectId, canvasId, canvasName, target: E2eTarget.Disposable };
}

const LIST_PAGE = 1000;

function storageOf(db: SupabaseClient): StoragePort {
  return {
    buckets: async () => ((await checked(db.storage.listBuckets())) ?? []).map((b) => b.name),
    list: async (bucket, prefix) => ((await checked(db.storage.from(bucket).list(prefix, { limit: LIST_PAGE }))) ?? []).map((e) => ({ name: e.name, folder: e.id === null })),
    remove: async (bucket, paths) => {
      await checked(db.storage.from(bucket).remove(paths));
    }
  };
}

function fixedBuckets(db: SupabaseClient, buckets: string[]): StoragePort {
  return { ...storageOf(db), buckets: async () => buckets };
}

async function teardownDisposable(session: E2eSession): Promise<void> {
  refuseAdminWrites(session.target);
  const db = adminClient();

  await purgeStorage(storageOf(db), [session.orgId, session.userId, `colours/${session.orgId}`]);

  await db.from('orgs').delete().eq('id', session.orgId);
  await db.auth.admin.deleteUser(session.userId);
}

type Lifecycle = {
  create(opts: SessionOptions): Promise<E2eSession>;
  teardown(session: E2eSession): Promise<void>;
  client(session: E2eSession): Promise<SupabaseClient>;
};

const LIFECYCLE: Record<E2eTarget, Lifecycle> = {
  [E2eTarget.Production]: {
    create: createInTestAccount,
    teardown: teardownInTestAccount,
    client: async (session) => (await userClient(session.email, session.password)).db
  },
  [E2eTarget.Disposable]: { create: createDisposable, teardown: teardownDisposable, client: async () => adminClient() }
};

/**
 * OGNI NAVIGAZIONE DI QUESTA SUITE PASSA DA QUI, non da `page.goto` nudo: in dev Vite compila
 * `+page.svelte` al volo, e un `click`/`fill` sparato prima che Svelte abbia agganciato
 * `use:enhance` invia un POST che il browser naviga per davvero invece di intercettare — un form
 * che sembra rotto ma è solo non ancora idratato. Un'unica funzione qui evita che ogni spec
 * scopra la stessa corsa per conto suo, con un `waitForLoadState` dimenticato in una e non
 * nell'altra.
 */
/**
 * Un `page.goto` può cadere in un `net::ERR_ABORTED` quando il router client-side di SvelteKit sta
 * ancora finendo la navigazione precedente (un `invalidateAll` in corso, per esempio subito dopo
 * un upload) — non un errore del prodotto, una corsa fra due navigazioni dello stesso browser. Un
 * secondo tentativo basta: se anche quello cade, il difetto è altrove e va lasciato emergere.
 */
async function gotoOnce(page: Page, path: string) {
  try {
    return await page.goto(path);
  } catch (err) {
    if (err instanceof Error && err.message.includes('ERR_ABORTED')) {
      return await page.goto(path);
    }
    throw err;
  }
}

const MODEL_SPEND = /\/api\/v1\/projects\/[^/]+\/(motion\/[^/]+\/)?agent$|\/api\/v1\/org\/nodes\/[^/]+\/generate$|\/prompts\/enhance$|\?\/run$/;
const SPEND_ALLOWED = process.env.E2E_ALLOW_SPEND === '1';

export async function refuseModelSpend(page: Page): Promise<string[]> {
  const refused: string[] = [];
  if (SPEND_ALLOWED) {
    return refused;
  }
  await page.route(MODEL_SPEND, (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    refused.push(route.request().url());
    return route.abort();
  });
  return refused;
}

const RENDERER = process.env.E2E_RENDERER;

const withRenderer = (path: string) => (RENDERER && !path.includes('renderer=') ? `${path}${path.includes('?') ? '&' : '?'}renderer=${RENDERER}` : path);

export async function gotoHydrated(page: Page, path: string): Promise<import('@playwright/test').Response | null> {
  const response = await gotoOnce(page, withRenderer(path));
  await page.waitForLoadState('networkidle');
  return response;
}

/**
 * `networkidle` basta su una macchina scarica, ma su una impegnata (molte altre app, molti
 * worker Playwright) il thread principale può restare occupato oltre quella finestra e il
 * `click` cade prima che `use:enhance` sia davvero agganciato — il form allora naviga per
 * davvero, e la pagina che arriva è di nuovo `/login` (vuota, senza `?/login` in coda: un giro
 * morto, non un errore di credenziali). `waitForResponse` aspetta il segnale vero — il POST che
 * `use:enhance` intercetta — non un'approssimazione temporale.
 */
export async function skipTour(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (window.self === window.top) {
      localStorage.setItem(key, '1');
    }
  }, TOUR_SEEN_KEY);
}

export async function signInE2e(page: Page, session: Pick<E2eSession, 'email' | 'password'>, tour: E2eTour = E2eTour.Seen): Promise<void> {
  if (tour === E2eTour.Seen) {
    await skipTour(page);
  }
  await gotoHydrated(page, '/login');
  await page.getByPlaceholder('you@yourbrand.com').fill(session.email);
  await page.locator('input[type="password"]').fill(session.password);

  const loggedIn = page.waitForResponse(
    (r) => r.url().includes('/login?/login') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await loggedIn;
  await page.waitForURL(/\/(app|p\/)/);
}

const SIGN_IN_DIR = 'tests/e2e/.auth';
const SIGN_IN_TTL_MS = 30 * 60_000;

function signInFile(email: string): string {
  return `${SIGN_IN_DIR}/${email.replace(/[^a-z0-9]/gi, '_')}.json`;
}

async function reuseSignIn(page: Page, session: Pick<E2eSession, 'email'>): Promise<boolean> {
  const file = signInFile(session.email);
  if (!existsSync(file) || Date.now() - statSync(file).mtimeMs > SIGN_IN_TTL_MS) {
    return false;
  }
  await skipTour(page);
  await page.context().addCookies(JSON.parse(readFileSync(file, 'utf8')));
  return true;
}

async function saveSignIn(page: Page, session: Pick<E2eSession, 'email'>): Promise<void> {
  mkdirSync(SIGN_IN_DIR, { recursive: true });
  writeFileSync(signInFile(session.email), JSON.stringify(await page.context().cookies()));
}

type CanvasNodeSeed = {
  type: string;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
};

/** Test fixtures: `{ page, orgId, projectId, canvasId, userId, admin }`, più `seedNode` per una
 *  precondizione che una spec vuole già scritta prima di aprire il browser. */
export const test = base.extend<{
  session: E2eSession;
  admin: SupabaseClient;
  seedNode: (seed: CanvasNodeSeed) => Promise<{ id: string; version: number }>;
}>({
  session: async ({}, use) => {
    const session = await createE2eSession();
    try {
      await use(session);
    } finally {
      await teardownE2eSession(session);
    }
  },

  admin: async ({ session }, use) => {
    await use(await LIFECYCLE[session.target].client(session));
  },

  page: async ({ page, session }, use) => {
    const unmocked = await refuseModelSpend(page);
    if (!(await reuseSignIn(page, session))) {
      await signInE2e(page, session);
      await saveSignIn(page, session);
    }
    await use(page);
    expect(unmocked, 'requests that would have spent on a real model; mock them, or set E2E_ALLOW_SPEND=1').toEqual([]);
  },

  seedNode: async ({ session, admin }, use) => {
    await use(async (seed: CanvasNodeSeed) => {
      const id = randomUUID();
      const row = await checked(
        admin
          .from('nodes')
          .insert({
            id,
            org_id: session.orgId,
            project_id: session.projectId,
            canvas_id: session.canvasId,
            type: seed.type,
            x: seed.x ?? 0,
            y: seed.y ?? 0,
            data: seed.data ?? {},
            actor_kind: 'user',
            actor_id: session.userId
          })
          .select('id, version')
          .single()
      );
      return row as { id: string; version: number };
    });
  }
});

export { expect };

export const REAL_STACK = process.env.E2E_REAL_STACK === '1';
export const ON_PRODUCTION = REAL_STACK && !!process.env.PUBLIC_SUPABASE_URL && e2eTarget() === E2eTarget.Production;
export const SOCIAL_PUBLISHING = process.env.E2E_SOCIAL_PUBLISHING === '1';
