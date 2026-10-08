import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { galleryReader } from '$lib/server/gallery/reader';
import { findGalleryItem } from '$lib/server/repos/gallery';
import { listMemberships } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { remixInto } from '$lib/server/gallery/service';
import { REMIX_STATUS } from '$lib/server/gallery/http';
import { stashOAuthReturn } from '$lib/server/oauth';
import { itemPath } from '$lib/gallery/model';
import { ProjectMode } from '$lib/project-mode';
import type { Db } from '$lib/server/db/client';

const HTTP_SEE_OTHER = 303;
const HTTP_NOT_FOUND = 404;
const LOGIN_PATH = '/login';

async function remixTargets(db: Db, userId: string, chosenOrg: string | null): Promise<{ id: string; name: string }[]> {
  const membership = chooseOrg(await listMemberships(db, userId), chosenOrg);
  const projects = membership ? await listProjects(db, membership.org.id) : [];
  return projects.filter((p) => p.mode === ProjectMode.Standard).map((p) => ({ id: p.id, name: p.name }));
}

function toLogin(event: Pick<RequestEvent, 'cookies' | 'params'>): never {
  stashOAuthReturn(event.cookies, itemPath(event.params.id ?? ''));
  throw redirect(HTTP_SEE_OTHER, LOGIN_PATH);
}

export const load: PageServerLoad = async ({ locals, params, cookies, setHeaders }) => {
  const { db, userId } = await galleryReader(locals);
  const item = await findGalleryItem(db, params.id);
  if (!item) {
    throw error(HTTP_NOT_FOUND, 'This video is not in the gallery');
  }
  setHeaders({ 'cache-control': 'no-store' });
  const projects = userId ? await remixTargets(db, userId, cookies.get(ORG_COOKIE) ?? null) : [];
  return { item, signedIn: userId !== null, projects };
};

export const actions: Actions = {
  signin: async (event) => toLogin(event),

  remix: async (event) => {
    const { user } = await event.locals.safeGetSession();
    if (!user) {
      toLogin(event);
    }
    const form = await event.request.formData();
    const scope = await toolScope(event, String(form.get('project') ?? '') || null);
    const remixed = await remixInto({ db: scope.db, orgId: scope.orgId, userId: scope.userId, actor: { kind: 'user', id: scope.userId } }, { itemId: event.params.id, projectId: scope.projectId, canvasId: null });
    if (!remixed.ok) {
      return fail(REMIX_STATUS[remixed.error], { error: remixed.message });
    }
    throw redirect(HTTP_SEE_OTHER, remixed.editorPath);
  }
};
