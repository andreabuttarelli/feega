import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { orgCreditBalance } from '$lib/server/credits';
import { listProjectAssets } from '$lib/server/repos/assets';
import { signedAssets } from '$lib/server/studio/studio-media';
import { startUpscale, UPSCALE_START_DEPS, type UpscaleSourceInput } from '$lib/server/upscale/start';
import { upscaleJob, upscalePricing } from '$lib/server/upscale/job';
import { OPENROUTER_UPSCALE_MODEL, upscaleLimitsOf } from '$lib/video-models';
import { UPSCALE_REFUSAL_TEXT, UpscaleMode, UpscaleTarget, type UpscaleRefusal } from '$lib/upscale';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNPROCESSABLE = 422;
const HTTP_SEE_OTHER = 303;
const LIBRARY_SIZE = 12;
const JOB_PARAM = 'job';

const LIMITS = upscaleLimitsOf(OPENROUTER_UPSCALE_MODEL)!;

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId } = await toolScope(event);
  const jobId = event.url.searchParams.get(JOB_PARAM);
  const [pricing, assets, balance, job] = await Promise.all([
    upscalePricing(db),
    listProjectAssets(db, { orgId, projectId }),
    orgCreditBalance(db as never, orgId),
    jobId ? upscaleJob(db, { orgId, projectId, nodeId: jobId }) : Promise.resolve(null)
  ]);

  const videos = assets.filter((a) => a.type === 'video' && LIMITS.inputMimeTypes.includes(a.mimeType ?? '')).slice(0, LIBRARY_SIZE);
  const { urls } = await signedAssets(db, orgId, videos.map((v) => v.id));

  return {
    projectId,
    orgId,
    pricing,
    limits: LIMITS,
    balance,
    job,
    library: videos.map((v) => ({ id: v.id, bytes: v.bytes, url: urls[v.id] ?? null }))
  };
};

function enumOf<T extends string>(values: Record<string, T>, raw: FormDataEntryValue | null): T | null {
  return (Object.values(values) as string[]).includes(String(raw)) ? (raw as T) : null;
}

function sourceOf(form: FormData): UpscaleSourceInput | null {
  if (form.get('source') === 'asset') {
    const assetId = String(form.get('asset_id') ?? '');
    return assetId ? { kind: 'asset', assetId } : null;
  }

  const path = String(form.get('path') ?? '');
  if (!path) {
    return null;
  }
  return { kind: 'upload', path, fileName: String(form.get('file_name') ?? 'clip.mp4'), mimeType: String(form.get('mime_type') ?? ''), bytes: Number(form.get('bytes')) };
}

function refusalText(error: string): string {
  return UPSCALE_REFUSAL_TEXT[error as UpscaleRefusal] ?? error;
}

export const actions: Actions = {
  start: async (event) => {
    const form = await event.request.formData();
    const scope = await toolScope(event, String(form.get('project') ?? '') || null);

    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, { error: denied.data.message });
    }

    const source = sourceOf(form);
    const target = enumOf(UpscaleTarget, form.get('target'));
    const mode = enumOf(UpscaleMode, form.get('mode'));
    if (!source || !target || !mode) {
      return fail(HTTP_BAD_REQUEST, { error: 'Choose a clip, a size and a mode.' });
    }

    const started = await startUpscale(scope.db, UPSCALE_START_DEPS, {
      orgId: scope.orgId,
      projectId: scope.projectId,
      userId: scope.userId,
      source,
      probe: { width: Number(form.get('width')), height: Number(form.get('height')), seconds: Number(form.get('seconds')) },
      target,
      mode
    });
    if (!started.ok) {
      return fail(HTTP_UNPROCESSABLE, { error: refusalText(started.error) });
    }

    throw redirect(HTTP_SEE_OTHER, `/app/upscale?project=${scope.projectId}&${JOB_PARAM}=${started.nodeId}`);
  }
};
