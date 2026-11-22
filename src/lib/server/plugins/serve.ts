import { json } from '@sveltejs/kit';
import { authenticate } from '$lib/server/cli-auth';
import { createAnonDb, type Db } from '$lib/server/db/client';
import { noCloudEntitlement } from './entitlement';
import { createPluginService, type Outcome, type PluginError, type PluginService } from './service';
import { supabasePluginStore } from './store';

const OK = 200;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;

const STATUS_OF: Record<PluginError, number> = {
  not_found: NOT_FOUND,
  not_installed: CONFLICT,
  plugin_locked: FORBIDDEN
};

export const badRequest = (error: string) => json({ error }, { status: BAD_REQUEST });

export function answer(outcome: Outcome): Response {
  if (outcome.ok) {
    return json({ ok: true }, { status: OK });
  }

  return json({ error: outcome.error }, { status: STATUS_OF[outcome.error] });
}

function serviceOf(db: Db): PluginService {
  return createPluginService(supabasePluginStore(db), noCloudEntitlement);
}

export type Signed = { service: PluginService; userId: string };

export async function signedIn(request: Request): Promise<Signed | Response> {
  const caller = await authenticate(request);
  if (caller.error) {
    return caller.error;
  }

  return { service: serviceOf(caller.supabase as unknown as Db), userId: caller.user.id };
}

export type Viewer = { service: PluginService; userId: string | null };

export async function viewerOf(request: Request): Promise<Viewer | Response> {
  if (!request.headers.get('authorization')) {
    return { service: serviceOf(createAnonDb()), userId: null };
  }

  return signedIn(request);
}
