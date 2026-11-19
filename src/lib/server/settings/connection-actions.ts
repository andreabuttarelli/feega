import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { Toolkit } from '$lib/server/connections/account-links';
import { accountFor } from '$lib/server/connections/runtime';
import { isToolkit, TOOLKITS } from '$lib/server/connections/toolkits';
import { localPath } from '$lib/server/code-import/github-http';

const HTTP_SEE_OTHER = 303;

enum ConnectionError {
  Unauthorized = 'unauthorized',
  Invalid = 'invalid',
  NotConfigured = 'not_configured'
}

const STATUS: Record<ConnectionError, number> = {
  [ConnectionError.Unauthorized]: 401,
  [ConnectionError.Invalid]: 400,
  [ConnectionError.NotConfigured]: 501
};

type Locals = { supabase: unknown; safeGetSession: () => Promise<{ user: { id: string } | null }> };
type ShellEvent = { locals: Locals; parent: () => Promise<{ org: { id: string } }> };
type Ev = Pick<RequestEvent, 'request' | 'url'> & { locals: Locals };

export type Connection = { toolkit: Toolkit; label: string; configured: boolean; connected: boolean; handle: string | null };

const refused = (error: ConnectionError) => fail(STATUS[error], { connectionError: error });

async function scopeOf(event: { locals: Locals }) {
  const parent = (event as Partial<ShellEvent>).parent;
  const { user } = await event.locals.safeGetSession();
  return user && parent ? { db: event.locals.supabase as Db, scope: { orgId: (await parent()).org.id, userId: user.id } } : null;
}

async function formOf(request: Request): Promise<{ toolkit: Toolkit; returnTo: string } | null> {
  const form = await request.formData();
  const toolkit = String(form.get('toolkit') ?? '');
  return isToolkit(toolkit) ? { toolkit, returnTo: localPath(String(form.get('returnTo') ?? '')) } : null;
}

export async function connections(event: ShellEvent): Promise<Connection[]> {
  const at = await scopeOf(event);
  if (!at) {
    return [];
  }
  return Promise.all(
    Object.values(Toolkit).map(async (toolkit) => {
      const { configured, connected, label } = await accountFor(at.db, at.scope, toolkit).status().catch(() => ({ configured: false, connected: false, label: null }));
      return { toolkit, label: TOOLKITS[toolkit].label, configured, connected, handle: label };
    })
  );
}

export async function connectAccount(event: Ev) {
  const at = await scopeOf(event);
  if (!at) {
    return refused(ConnectionError.Unauthorized);
  }
  const asked = await formOf(event.request);
  if (!asked) {
    return refused(ConnectionError.Invalid);
  }
  const started = await accountFor(at.db, at.scope, asked.toolkit).connect(event.url.origin, asked.returnTo);
  if (!started) {
    return refused(ConnectionError.NotConfigured);
  }
  redirect(HTTP_SEE_OTHER, started.url);
}

export async function disconnectAccount(event: Ev) {
  const at = await scopeOf(event);
  if (!at) {
    return refused(ConnectionError.Unauthorized);
  }
  const asked = await formOf(event.request);
  if (!asked) {
    return refused(ConnectionError.Invalid);
  }
  await accountFor(at.db, at.scope, asked.toolkit).disconnect();
  return { disconnected: asked.toolkit };
}
