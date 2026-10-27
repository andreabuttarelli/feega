import { fail } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';

type BatchParams = { batchId: string };
import { batchScope } from '$lib/server/dashboard/tool-scope';
import { studioOptions } from '$lib/server/studio/studio-options';
import { applyAction, BatchAction, type ActionInput, type BatchScope } from '$lib/server/studio/studio-actions';
import { listItems } from '$lib/server/repos/product-batches';
import { signedAssets } from '$lib/server/studio/studio-media';
import { orgCreditBalance } from '$lib/server/credits';
import { ENVIRONMENTS, isEnvironment } from '$lib/studio/environments';
import { SHOTS, isShot } from '$lib/studio/shots';
import { MAX_VARIATIONS } from '$lib/studio/plan';
import { MARKETPLACES } from '$lib/studio/marketplace';

export const config = { maxDuration: 300 };

export const load = async (event: ServerLoadEvent<BatchParams>) => {
  const scope = await batchScope(event);
  event.depends(`studio:batch:${scope.batch.id}`);
  return batchView(scope);
};

export async function batchView({ db, orgId, projectId, batch }: BatchScope) {
  const [items, balance, options] = await Promise.all([
    listItems(db, { orgId, batchId: batch.id }),
    orgCreditBalance(db, orgId),
    studioOptions(db, { orgId, projectId })
  ]);
  const originals = Object.fromEntries(options.products.map((p) => [p.title, p.image]));
  const { urls } = await signedAssets(db, orgId, items.flatMap((i) => (i.assetId ? [i.assetId] : [])), 'mediaGrid');
  const perImage = options.imageModels.find((m) => m.id === batch.model)?.credits ?? null;
  const modelNames = Object.fromEntries(options.models.map((m) => [m.id, m.name]));

  return {
    projectId,
    batch: { id: batch.id, name: batch.name, status: batch.status, canvasId: batch.canvasId, model: batch.model, previewModel: batch.previewModel, droppedRefs: batch.spec.droppedRefs },
    items: items.map((i) => ({
      id: i.id,
      productTitle: i.productTitle,
      model: i.influencerId ? (modelNames[i.influencerId] ?? 'Model') : null,
      environment: isEnvironment(i.environment) ? ENVIRONMENTS[i.environment].label : i.environment,
      shot: isShot(i.shot) ? SHOTS[i.shot].label : i.shot,
      variation: i.variation,
      preview: i.preview,
      status: i.status,
      error: i.error,
      approval: i.approval,
      url: i.assetId ? (urls[i.assetId] ?? null) : null,
      original: originals[i.productTitle] ?? null
    })),
    marketplaces: Object.entries(MARKETPLACES).map(([id, m]) => ({ id, label: m.label, size: m.size })),
    perImage,
    balance,
    maxVariations: MAX_VARIATIONS
  };
}

function inputOf(fd: FormData): ActionInput {
  return { itemIds: fd.getAll('itemId').map(String).filter(Boolean), variations: Number(fd.get('variations') ?? 1) };
}

async function act(event: RequestEvent<BatchParams>, action: BatchAction) {
  const scope = await batchScope(event);
  const result = await applyAction(scope, action, inputOf(await event.request.formData().catch(() => new FormData())));
  return 'error' in result ? fail(result.status, { error: result.error }) : result.data;
}

export const actions: Actions<BatchParams> = {
  run: (event) => act(event, BatchAction.Run),
  more: (event) => act(event, BatchAction.More),
  cancel: (event) => act(event, BatchAction.Cancel),
  retry: (event) => act(event, BatchAction.Retry),
  regenerate: (event) => act(event, BatchAction.Regenerate),
  approve: (event) => act(event, BatchAction.Approve),
  reject: (event) => act(event, BatchAction.Reject),
  drain: (event) => act(event, BatchAction.Drain)
};

export type BatchData = Awaited<ReturnType<typeof load>>;
