import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createShareReadDb, signSharedMedia } from '$lib/server/canvas/canvas-share';
import { readSharedFrame } from '$lib/server/canvas/frame-share';
import { duplicateSharedFrame } from '$lib/server/canvas/frame-duplicate';
import { embedPublished } from '$lib/server/motion/embed';
import { standardTargets } from '$lib/server/projects/standard-targets';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { REMIX_STATUS } from '$lib/server/gallery/http';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { stashOAuthReturn } from '$lib/server/oauth';
import { embedUrl } from '$lib/motion/interactive/bundle';
import { Fit } from '$lib/motion/interactive/fit';

const HTTP_SEE_OTHER = 303;
const LOGIN_PATH = '/login';

const framePath = (params: { token: string; frame: string }) => `/s/${params.token}/${params.frame}`;

function toLogin(event: Pick<RequestEvent, 'cookies' | 'params'>): never {
  stashOAuthReturn(event.cookies, framePath(event.params as { token: string; frame: string }));
  throw redirect(HTTP_SEE_OTHER, LOGIN_PATH);
}

export const load: PageServerLoad = async ({ params, setHeaders, locals, cookies }) => {
  const db = createShareReadDb();
  const frame = await readSharedFrame(db, params.token, params.frame, (nodeId) => embedPublished(db, nodeId));
  if (!frame) {
    throw error(404, 'Not found');
  }

  const { user } = await locals.safeGetSession();
  const member = user ? await locals.db() : null;
  const projects = user && member ? await standardTargets(member, user.id, cookies.get(ORG_COOKIE) ?? null) : [];

  setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  return { frame, embedSrc: `${embedUrl('', frame.frameId)}?fit=${Fit.Contain}`, signedIn: user !== null, projects };
};

export const actions: Actions = {
  signin: async (event) => toLogin(event),

  duplicate: async (event) => {
    const { user } = await event.locals.safeGetSession();
    if (!user) {
      toLogin(event);
    }

    const form = await event.request.formData();
    const scope = await toolScope(event, String(form.get('project') ?? '') || null);
    const source = createShareReadDb();
    const copied = await duplicateSharedFrame(
      {
        source,
        target: scope.db,
        sign: (paths) => signSharedMedia(source)({ ...paths, influencer: [] }),
        isPublished: (nodeId) => embedPublished(source, nodeId)
      },
      { token: event.params.token, frameId: event.params.frame, orgId: scope.orgId, userId: scope.userId, actor: { kind: 'user', id: scope.userId }, projectId: scope.projectId, canvasId: null }
    );
    if (!copied.ok) {
      return fail(REMIX_STATUS[copied.error], { error: copied.message });
    }
    throw redirect(HTTP_SEE_OTHER, copied.editorPath);
  }
};
