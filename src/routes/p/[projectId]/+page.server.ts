import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createCanvas } from '$lib/server/repos/canvas';
import { DEFAULT_CANVAS_NAME, canvasPath } from '$lib/server/tenancy/entry';

export const load: PageServerLoad = async ({ parent, locals }) => {
  const { project, org, canvases } = await parent();
  const first = canvases[0];
  if (first) {
    throw redirect(302, canvasPath(project.id, first.id));
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }
  const canvas = await createCanvas(db, { orgId: org.id, projectId: project.id, name: DEFAULT_CANVAS_NAME });
  throw redirect(302, canvasPath(project.id, canvas.id));
};
