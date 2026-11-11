import { json } from '@sveltejs/kit';
import { tokensFound } from '$lib/server/code-import/canvas-import';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const MAX_SOURCE = 1000;

export const GET: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const repo = event.url.searchParams.get('repo') ?? undefined;
  const folder = event.url.searchParams.get('folder') ?? undefined;
  const source = repo ?? folder;
  if (!source || source.length > MAX_SOURCE) {
    return json({ error: 'invalid' }, { status: BAD_REQUEST });
  }

  const tokens = await tokensFound({ ...scope, actor: { kind: 'user', id: scope.userId } }, repo ? { repo } : { folder });
  return json({ tokens: tokens ?? 0 });
};
