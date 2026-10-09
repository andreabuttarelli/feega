import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { DASHBOARD_PATH, DEFAULT_CANVAS_NAME, DEFAULT_PROJECT_NAME, ENTRY_DEPS, canvasPath, homePathFor } from '$lib/server/tenancy/entry';
import { chooseOrg, LAST_PROJECT_COOKIE, ORG_COOKIE } from '$lib/server/tenancy/context';
import { takeCampaign } from '$lib/server/onboarding/campaign-cookie';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { DASHBOARD_DEPS, dashboardFor } from '$lib/server/dashboard/dashboard';
import { listMemberships } from '$lib/server/repos/orgs';
import { createProject } from '$lib/server/repos/projects';
import { createCanvas } from '$lib/server/repos/canvas';
import { SUPPORT_TOOLS } from '$lib/tools';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { MOTION_START_DEPS, startMotion } from '$lib/server/motion/start';
import { listGallery } from '$lib/server/repos/gallery';
import { gallerySearchSchema } from '$lib/gallery/model';
import { BRIEF_MAX, BRIEF_TEMPLATES, briefEditorPath, briefMessage, briefName } from '$lib/motion/video-brief';

const HTTP_SEE_OTHER = 303;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HOME_GALLERY_SIZE = 8;
const ORG_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const SLUG_BYTES = 4;

export const load: PageServerLoad = async (event) => {
  const { db, user } = await signedInDb(event);
  const { cookies } = event;
  const path = await homePathFor(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, cookies.get(LAST_PROJECT_COOKIE) ?? null, takeCampaign(cookies));
  if (path !== DASHBOARD_PATH) {
    throw redirect(HTTP_SEE_OTHER, path);
  }

  const { org } = await event.parent();
  const [dashboard, gallery] = await Promise.all([dashboardFor(db, DASHBOARD_DEPS, org.id), listGallery(db, gallerySearchSchema.parse({ limit: HOME_GALLERY_SIZE }))]);
  return { dashboard, gallery, templates: BRIEF_TEMPLATES, tools: SUPPORT_TOOLS };
};

function projectSlug(): string {
  const suffix = [...crypto.getRandomValues(new Uint8Array(SLUG_BYTES))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `project-${suffix}`;
}

export const actions: Actions = {
  video: async (event) => {
    const brief = String((await event.request.formData()).get('brief') ?? '').trim().slice(0, BRIEF_MAX);
    if (!brief) {
      return fail(HTTP_BAD_REQUEST, { error: 'Paste a URL or describe your video' });
    }

    const scope = await toolScope(event);
    const started = await startMotion(scope.db, MOTION_START_DEPS, { orgId: scope.orgId, projectId: scope.projectId, canvasId: null, userId: scope.userId, name: briefName(brief) });
    if (!started) {
      return fail(HTTP_NOT_FOUND, { error: 'No canvas for this video' });
    }

    throw redirect(HTTP_SEE_OTHER, briefEditorPath(started, briefMessage(brief)));
  },

  project: async (event) => {
    const { db, user } = await signedInDb(event);
    const membership = chooseOrg(await listMemberships(db, user.id), event.cookies.get(ORG_COOKIE) ?? null);
    if (!membership) {
      return fail(HTTP_NOT_FOUND, { error: 'No workspace' });
    }

    const name = String((await event.request.formData()).get('name') ?? '').trim() || DEFAULT_PROJECT_NAME;
    const project = await createProject(db, { orgId: membership.org.id, name, slug: projectSlug() });
    const canvas = await createCanvas(db, { orgId: membership.org.id, projectId: project.id, name: DEFAULT_CANVAS_NAME });
    throw redirect(HTTP_SEE_OTHER, canvasPath(project.id, canvas.id));
  },

  workspace: async (event) => {
    const { db, user } = await signedInDb(event);
    const orgId = String((await event.request.formData()).get('orgId') ?? '');
    const memberships = await listMemberships(db, user.id);
    if (!memberships.some((m) => m.org.id === orgId)) {
      return fail(HTTP_NOT_FOUND, { error: 'Not your workspace' });
    }

    event.cookies.set(ORG_COOKIE, orgId, { path: '/', maxAge: ORG_COOKIE_MAX_AGE_S });
    throw redirect(HTTP_SEE_OTHER, DASHBOARD_PATH);
  }
};
