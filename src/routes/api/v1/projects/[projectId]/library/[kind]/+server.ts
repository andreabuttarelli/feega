import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectScope } from '$lib/server/canvas/project-scope';
import { listEntries } from '$lib/server/repos/project-library';
import { runLibrary } from '$lib/server/canvas/project-library';
import { isLibraryKind, libraryOpSchema, type LibraryAsk } from '$lib/motion/project-library-ops';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

async function scopeOf(event: Parameters<RequestHandler>[0]) {
  const { kind } = event.params;
  if (!isLibraryKind(kind)) {
    return json({ error: `no library ${kind}` }, { status: NOT_FOUND });
  }
  const scope = await projectScope(event, event.params.projectId);
  return scope instanceof Response ? scope : { ...scope, kind };
}

export const GET: RequestHandler = async (event) => {
  const scope = await scopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  return json({ entries: await listEntries(scope.db, scope) });
};

export const POST: RequestHandler = async (event) => {
  const scope = await scopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  const ask = libraryOpSchema(scope.kind).safeParse(await event.request.json().catch(() => null));
  if (!ask.success) {
    return json({ error: ask.error.issues[0].message }, { status: BAD_REQUEST });
  }
  const answer = await runLibrary(scope.db, scope, ask.data as LibraryAsk);
  return answer.ok ? json({ entries: answer.entries }) : json({ error: answer.error }, { status: CONFLICT });
};
