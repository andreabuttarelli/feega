import { json } from '@sveltejs/kit';
import { appAccountStore, readAppAccount } from '$lib/server/repos/app-accounts';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
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
