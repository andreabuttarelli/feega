import { createClient, createServerClient } from '$lib/server/db/connect';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { markRlsScoped } from '$lib/server/rls-client';
import { LOCAL_AI_MESSAGE, localStore } from '$lib/server/local/local-mode';
import { hasAiKey } from '$lib/local-ai-keys';
import { ProductEvent, track } from '$lib/server/product-events/track';
import { scopesOfHolder } from '$lib/server/api-key-holder';

export interface ApiKeyInfo {
  id: string;
  name: string;
  user_id: string;
  org_id: string;
  scopes: string[];
}

/**
 * Authenticate a CLI/API request via Bearer token.
 * Supports two token types:
 *   1. Supabase JWT (standard session token)
 *   2. API Key (starts with "feega_", long-lived, hashed in DB)
 *
 * Returns the Supabase client scoped to the user, or an error Response.
 */
type Caller =
  | { supabase: SupabaseClient; user: { id: string; email?: string }; apiKey?: ApiKeyInfo; error?: undefined }
  | { supabase?: undefined; user?: undefined; apiKey?: undefined; error: Response };

export async function authenticate(request: Request): Promise<Caller> {
  return resolveCaller(request);
}

async function resolveCaller(request: Request): Promise<Caller> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { error: json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) };
  }
  const token = auth.slice(7);

  // ── API Key path ──────────────────────────────────────────────
  // legacy 021_live_*, anomalia_* and dazero_* prefixes migrated from the pre-renaming eras
  if (
    token.startsWith('feega_') ||
    token.startsWith('dazero_') ||
    token.startsWith('anomalia_') ||
    token.startsWith('021_live_')
  ) {
    const res = await authenticateApiKey(token);
    if ('error' in res && res.error) return res;
    // Write scope, enforced once here instead of per-route: a read-only key may only ever read.
    // Every mutating CLI route is a non-GET, so the method is the whole check.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const denied = checkApiKeyWriteAccess((res as { apiKey: ApiKeyInfo }).apiKey);
      if (denied) return { error: denied };
    }
    return res;
  }

  // ── Supabase JWT path (existing) ─────────────────────────────
  const supabase = createServerClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [],
      setAll: () => {}
    },
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  // Chiave anon + il JWT dell'utente: Postgres valuta le sue policy, esattamente come nel browser.
  // Il marchio si DICHIARA perché il client, guardato da fuori, è indistinguibile dalla service
  // role — e la sessione qui non c'è: i cookie sono a vuoto per costruzione, non per errore.
  return { supabase: markRlsScoped(supabase), user };
}

async function authenticateApiKey(token: string) {
  const keyHash = await hashApiKey(token);

  // Service-role client to look up the key (bypasses RLS)
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminKey) {
    return { error: json({ error: 'Server misconfiguration' }, { status: 500 }) };
  }
  const admin = createClient(publicEnv.PUBLIC_SUPABASE_URL, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: keyRow, error: lookupError } = await admin
    .from('api_keys')
    .select('id, user_id, org_id, name, scopes, expires_at, revoked_at, last_used_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (lookupError || !keyRow) {
    return { error: json({ error: 'Invalid API key' }, { status: 401 }) };
  }
  if (keyRow.revoked_at) {
    return { error: json({ error: 'Invalid API key' }, { status: 401 }) };
  }
  if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()) {
    return { error: json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  const scopes = await scopesOfHolder(admin, keyRow);
  if (!scopes) {
    return { error: json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  // Fire-and-forget: update last_used_at
  admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);
  if (!keyRow.last_used_at) {
    void track(ProductEvent.AgentConnected, { userId: keyRow.user_id, orgId: keyRow.org_id }, { key_id: keyRow.id });
  }

  const apiKey: ApiKeyInfo = {
    id: keyRow.id,
    name: keyRow.name,
    user_id: keyRow.user_id,
    org_id: keyRow.org_id,
    scopes
  };

  const supabase = createClient(publicEnv.PUBLIC_SUPABASE_URL, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return {
    supabase,
    user: { id: keyRow.user_id },
    apiKey
  };
}

/** Hash an API key with SHA-256, returns hex string. */
export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a new API key. Returns the raw key (show once) and the hash (store). */
export async function generateApiKey(): Promise<{ raw: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const raw = `feega_live_${hex}`;
  const hash = await hashApiKey(raw);
  const prefix = raw.slice(0, 16); // "feega_live_<first 5 hex>"
  return { raw, hash, prefix };
}

// ── API Key permission helpers ─────────────────────────────────

/**
 * Check if an API key has write permission.
 * Returns undefined if allowed, or a 403 Response if denied.
 * For JWT auth (no apiKey), this is a no-op.
 */
export function checkApiKeyWriteAccess(
  apiKey: ApiKeyInfo | undefined
): Response | undefined {
  if (!apiKey) return undefined; // JWT auth
  if (apiKey.scopes.includes('write')) return undefined;
  return json({ error: 'API key is read-only' }, { status: 403 });
}

/**
 * L'esito di un cancello crediti, indipendente da come chi ha chiamato deve restituirlo: una
 * rotta API vuole una `Response`, una form action di SvelteKit vuole un oggetto che `fail()`
 * costruisce — restituire una `Response` da un'azione fallisce a runtime con "Data returned from
 * action … is not serializable", e chi guarda vede un errore generico al posto di "crediti
 * finiti". Un solo controllo del saldo (qui sotto), due modi di raccontarne il rifiuto.
 */
export type CreditGateDenial = { status: number; data: { error: string; message: string } };

const CREDITS_EXHAUSTED_MESSAGE = 'AI credits are exhausted for this billing period. Buy more to continue.';

async function creditGateOutcome(spend: () => Promise<void>): Promise<CreditGateDenial | undefined> {
  if (localStore()) {
    return hasAiKey(process.env) ? undefined : { status: 403, data: { error: 'local_mode', message: LOCAL_AI_MESSAGE } };
  }
  const { CreditsExhaustedError } = await import('./credits');
  try {
    await spend();
  } catch (e) {
    if (e instanceof CreditsExhaustedError) {
      return { status: 402, data: { error: 'credits_exhausted', message: CREDITS_EXHAUSTED_MESSAGE } };
    }
    throw e;
  }
  return undefined;
}

export async function gateOrgAiAction(
  orgId: string,
  apiKey: ApiKeyInfo | undefined
): Promise<Response | undefined> {
  const write = checkApiKeyWriteAccess(apiKey);
  if (write) return write;

  const { gateOrgCredits } = await import('./credits');
  const denial = await creditGateOutcome(() => gateOrgCredits(orgId));
  return denial ? json(denial.data, { status: denial.status }) : undefined;
}

/** Lo stesso cancello di gateOrgAiAction, per una form action: nessuna Response, un esito per fail(). */
export async function gateOrgAiActionForForm(orgId: string): Promise<CreditGateDenial | undefined> {
  const { gateOrgCredits } = await import('./credits');
  return creditGateOutcome(() => gateOrgCredits(orgId));
}

export type OrgScope = {
  supabase: SupabaseClient;
  user: { id: string; email?: string };
  orgId: string;
  /** Chi ha pagato, per nome: il chiamante non l'ha scelto, quindi la risposta glielo dice. */
  organization: { id: string; name: string | null };
  apiKey?: ApiKeyInfo;
};

export async function openOrgScope(
  request: Request
): Promise<{ scope: OrgScope; error?: undefined } | { scope?: undefined; error: Response }> {
  return orgScopeFor(await authenticate(request));
}

/**
 * La parte che DECIDE, separata da quella che autentica. Sono due mestieri, e tenerli insieme
 * rendeva i rifiuti raggiungibili solo passando da una chiave API vera: qui si provano per quello
 * che sono, uno per uno.
 */
const HTTP_FORBIDDEN = 403;

type ActiveOrg = { orgId: string | null; mayEdit: boolean };

async function activeOrgOf(supabase: SupabaseClient, user: User): Promise<ActiveOrg> {
  const { listMemberships } = await import('$lib/server/repos/orgs');
  const [active] = await listMemberships(supabase as never, user.id);
  if (active) {
    const { can, OrgAction } = await import('$lib/org-roles');
    return { orgId: active.org.id, mayEdit: can(active.role, OrgAction.Edit) };
  }

  const { ensureOrgForUser } = await import('./org');
  return { orgId: await ensureOrgForUser(supabase, user), mayEdit: true };
}

export async function orgScopeFor(
  caller: Caller
): Promise<{ scope: OrgScope; error?: undefined } | { scope?: undefined; error: Response }> {
  const { supabase, user, error, apiKey } = caller;
  if (error) return { error };

  const { orgId, mayEdit } = apiKey ? { orgId: apiKey.org_id, mayEdit: true } : await activeOrgOf(supabase, user as never);
  if (!mayEdit) return { error: json({ error: 'view_only', message: 'Viewers cannot generate or edit. Ask an admin for edit access.' }, { status: HTTP_FORBIDDEN }) };
  if (!orgId) return { error: json({ error: 'no_organization' }, { status: 500 }) };

  const gate = await gateOrgAiAction(orgId, apiKey);
  if (gate) return { error: gate };

  const { data } = await supabase.from('orgs').select('id, name').eq('id', orgId).maybeSingle();

  return {
    scope: {
      supabase,
      user,
      orgId,
      organization: { id: orgId, name: (data?.name as string | null | undefined) ?? null },
      apiKey
    }
  };
}

export type OrgCall = {
  supabase: SupabaseClient;
  user: { id: string; email?: string };
  orgId: string;
  apiKey?: ApiKeyInfo;
};

export async function openOrg(
  request: Request
): Promise<{ call: OrgCall; error?: undefined } | { call?: undefined; error: Response }> {
  const { supabase, user, apiKey, error } = await authenticate(request);
  if (error) {
    return { error };
  }

  const orgId = apiKey ? apiKey.org_id : (await activeOrgOf(supabase, user as User)).orgId;
  if (!orgId) {
    return { error: json({ error: 'no_organization' }, { status: 500 }) };
  }

  return { call: { supabase, user, orgId, apiKey } };
}
