import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { DASHBOARD_DEPS, dashboardFor } from '$lib/server/dashboard/dashboard';
import { MOTION_START_DEPS, startMotion } from '$lib/server/motion/start';
import { listCanvases } from '$lib/server/repos/canvas';
import { motionEditorPath } from '$lib/canvas/motion-node';

const HTTP_SEE_OTHER = 303;
const HTTP_NOT_FOUND = 404;
const UNTITLED_VIDEO = 'Untitled video';

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId } = await toolScope(event);
  const [dashboard, canvases] = await Promise.all([dashboardFor(db, DASHBOARD_DEPS, orgId), listCanvases(db, { orgId, projectId })]);

  return {
    projectId,
    canvases: canvases.map((c) => ({ id: c.id, name: c.name })),
    motions: dashboard.motions
  };
};

export const actions: Actions = {
  create: async (event) => {
    const form = await event.request.formData();
    const scope = await toolScope(event, String(form.get('project') ?? '') || null);
    const started = await startMotion(scope.db, MOTION_START_DEPS, {
      orgId: scope.orgId,
      projectId: scope.projectId,
      canvasId: String(form.get('canvas') ?? '') || null,
      userId: scope.userId,
      name: String(form.get('name') ?? '').trim() || UNTITLED_VIDEO
    });
    if (!started) {
      return fail(HTTP_NOT_FOUND, { error: 'That canvas is not in this project' });
    }

    throw redirect(HTTP_SEE_OTHER, motionEditorPath(started));
  }
};
