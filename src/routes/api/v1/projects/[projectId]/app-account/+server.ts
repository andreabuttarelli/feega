import { json } from '@sveltejs/kit';
import { appAccountStore, readAppAccount, setTestAccount } from '$lib/server/repos/app-accounts';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  return json({ account: await readAppAccount(scope.db, scope) });
};

const HTTP_BAD_REQUEST = 400;

export const PUT: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : '');
  const refused = await setTestAccount(appAccountStore(scope.db, { ...scope, actor: { kind: 'user', id: scope.userId } }), { loginUrl: text('login_url'), email: text('email'), password: text('password') });
  if (refused) {
    return json({ error: refused }, { status: HTTP_BAD_REQUEST });
  }
  return json({ account: await readAppAccount(scope.db, scope) });
};

export const DELETE: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  await appAccountStore(scope.db, { ...scope, actor: { kind: 'user', id: scope.userId } }).forget();
  return json({ ok: true });
};
