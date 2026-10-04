import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { COMPOSE_DEPS, openCanvasComposition, recentCompositions, startComposition, type ComposeStart } from '$lib/server/motion/compose';
import { composeEditorPath, newDraft } from '$lib/motion/composition-draft';
import { COMPOSITION_LAYOUTS } from '$lib/motion/components';
import { MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import type { LayoutId } from '$lib/canvas/composition/types';
import { listProjectAssets } from '$lib/server/repos/assets';
import { signedAssets } from '$lib/server/studio/studio-media';

const HTTP_SEE_OTHER = 303;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const UNTITLED = 'Untitled composition';
const SAMPLE_COUNT = 8;

async function samplePictures(db: Parameters<typeof listProjectAssets>[0], scope: { orgId: string; projectId: string }): Promise<string[]> {
  const pictures = (await listProjectAssets(db, scope)).filter((a) => a.type === 'image').slice(0, SAMPLE_COUNT);
  const { urls } = await signedAssets(db, scope.orgId, pictures.map((p) => p.id), 'pickerTile');
  return pictures.map((p) => urls[p.id]).filter((url): url is string => Boolean(url));
}

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId } = await toolScope(event);
  const [recent, samples] = await Promise.all([recentCompositions(db, COMPOSE_DEPS, { orgId, projectId }), samplePictures(db, { orgId, projectId })]);
  return { projectId, recent, samples };
};

function oneOf<T extends string>(values: readonly T[], raw: FormDataEntryValue | null): T | null {
  return values.includes(String(raw) as T) ? (raw as T) : null;
}

function opened(started: ComposeStart) {
  if (!started.ok) {
    return fail(HTTP_NOT_FOUND, { error: started.error });
  }
  throw redirect(HTTP_SEE_OTHER, composeEditorPath(started.start));
}

export const actions: Actions = {
  create: async (event) => {
    const form = await event.request.formData();
    const layout = oneOf<LayoutId>(COMPOSITION_LAYOUTS, form.get('layout'));
    const format = oneOf<MotionFormat>(MOTION_FORMATS, form.get('format')) ?? MotionFormat.Vertical;
    if (!layout) {
      return fail(HTTP_BAD_REQUEST, { error: 'Pick a template.' });
    }

    const scope = await toolScope(event, String(form.get('project') ?? '') || null);
    return opened(
      await startComposition(scope.db, COMPOSE_DEPS, {
        orgId: scope.orgId,
        projectId: scope.projectId,
        canvasId: null,
        userId: scope.userId,
        name: String(form.get('name') ?? '').trim() || UNTITLED,
        draft: { ...newDraft(layout), format }
      })
    );
  },

  fromNode: async (event) => {
    const form = await event.request.formData();
    const scope = await toolScope(event, String(form.get('project') ?? '') || null);
    return opened(
      await openCanvasComposition(scope.db, COMPOSE_DEPS, {
        orgId: scope.orgId,
        projectId: scope.projectId,
        canvasId: String(form.get('canvas') ?? ''),
        nodeId: String(form.get('node') ?? ''),
        userId: scope.userId
      })
    );
  }
};
