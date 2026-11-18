import { json } from '@sveltejs/kit';
import { generateApiKey, openOrg } from '$lib/server/cli-auth';
import { can, OrgAction } from '$lib/org-roles';
import { memberRole } from '$lib/server/repos/orgs';
import type { Db } from '$lib/server/db/client';
import type { RequestHandler } from './$types';

/** GET — list API keys for the org (never returns raw keys) */
export const GET: RequestHandler = async ({ request }) => {
  const { call, error: authError } = await openOrg(request);
  if (authError) return authError;

  // Own keys only — the API-key path runs as service-role, so the user filter can't be left to RLS.
  const { data: keys, error } = await call.supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, created_at, last_used_at')
    .eq('user_id', call.user.id)
    .eq('org_id', call.orgId)
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, { status: 500 });

  return json({ keys: keys ?? [] });
};

/** POST — create a new API key. Returns the raw key once. */
export const POST: RequestHandler = async ({ request }) => {
  const { call, error: authError } = await openOrg(request);
  if (authError) return authError;

  // Minting requires a full session. Clamping a key-minted key to its parent's boundaries is not
  // enough: the child is an independent row, so it outlives the revocation of the parent and a
  // stolen key becomes permanent. No mint chain — a human session is the only way to create keys.
  if (call.apiKey) {
    return json({ error: 'API keys cannot create API keys — sign in with the CLI' }, { status: 403 });
  }

  const role = await memberRole(call.supabase as unknown as Db, { orgId: call.orgId, userId: call.user.id });
  if (!role || !can(role, OrgAction.ManageApiKeys)) {
    return json({ error: 'Your role cannot create API keys' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name: string = (body.name || '').trim() || 'API Key';
  const requestedScopes: string[] = Array.isArray(body.scopes) ? body.scopes : ['read'];

  // Validate scopes
  const validScopes = requestedScopes.filter((s) => s === 'read' || s === 'write');
  if (!validScopes.includes('read')) validScopes.push('read');

  const { raw, hash, prefix } = await generateApiKey();

  const { data, error } = await call.supabase
    .from('api_keys')
    .insert({
      org_id: call.orgId,
      user_id: call.user.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: validScopes
    })
    .select('id, name, key_prefix, scopes, created_at')
    .single();

  if (error) return json({ error: error.message }, { status: 500 });

  return json({
    key: { ...data, raw },
    message: 'Copy this key now — you will not be able to see it again.'
  }, { status: 201 });
};
