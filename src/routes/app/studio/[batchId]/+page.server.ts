import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { batchScope } from '$lib/server/dashboard/tool-scope';
import { studioOptions } from '$lib/server/studio/studio-options';
import { approveItem, cancelBatch, moreVariations, requeueItems, runBatch } from '$lib/server/studio/studio-batch';
import { drainStudio } from '$lib/server/studio/studio-drain';
import { listItems } from '$lib/server/repos/product-batches';
import { signedAssets } from '$lib/server/studio/studio-media';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { orgCreditBalance } from '$lib/server/credits';
import { Approval, ItemStatus } from '$lib/studio/batch-state';
import { ENVIRONMENTS, isEnvironment } from '$lib/studio/environments';
import { SHOTS, isShot } from '$lib/studio/shots';
import { MAX_VARIATIONS } from '$lib/studio/plan';
import { MARKETPLACES } from '$lib/studio/marketplace';
import { sendToCalendar } from '$lib/server/studio/studio-calendar';
import { listOrgBrands } from '$lib/server/repos/brands';

export const config = { maxDuration: 300 };

const HTTP_BAD_REQUEST = 400;
const HTTP_UNPROCESSABLE = 422;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId, batch } = await batchScope(event);
  event.depends(`studio:batch:${batch.id}`);

  const [items, balance, options, brands] = await Promise.all([
    listItems(db, { orgId, batchId: batch.id }),
    orgCreditBalance(db, orgId),
    studioOptions(db, { orgId, projectId }),
    listOrgBrands(db, orgId)
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
    brands: brands.map((b) => ({ id: b.id, name: b.name })),
    marketplaces: Object.entries(MARKETPLACES).map(([id, m]) => ({ id, label: m.label, size: m.size })),
    perImage,
    balance,
    maxVariations: MAX_VARIATIONS
  };
};

function idsOf(fd: FormData): string[] {
  return fd.getAll('itemId').map(String).filter(Boolean);
}

async function gated(orgId: string) {
  const denied = await gateOrgAiActionForForm(orgId);
  return denied ? fail(denied.status, { error: denied.data.message }) : null;
}

export const actions: Actions = {
  run: async (event) => {
    const scope = await batchScope(event);
    const denied = await gated(scope.orgId);
    if (denied) {
      return denied;
    }
    const outcome = await runBatch(scope.db, scope, event.params.batchId, await studioOptions(scope.db, scope));
    return 'error' in outcome ? fail(HTTP_UNPROCESSABLE, { error: outcome.error }) : { ok: true };
  },

  more: async (event) => {
    const scope = await batchScope(event);
    const denied = await gated(scope.orgId);
    if (denied) {
      return denied;
    }
    const variations = Number((await event.request.formData()).get('variations') ?? 1);
    const outcome = await moreVariations(scope.db, scope, event.params.batchId, await studioOptions(scope.db, scope), Math.min(Math.max(variations, 1), MAX_VARIATIONS));
    return 'error' in outcome ? fail(HTTP_UNPROCESSABLE, { error: outcome.error }) : { ok: true };
  },

  cancel: async (event) => {
    const scope = await batchScope(event);
    return { cancelled: await cancelBatch(scope.db, scope, event.params.batchId) };
  },

  retry: async (event) => {
    const scope = await batchScope(event);
    const denied = await gated(scope.orgId);
    if (denied) {
      return denied;
    }
    const itemIds = idsOf(await event.request.formData());
    return { requeued: await requeueItems(scope.db, scope, { batchId: event.params.batchId, itemIds, from: [ItemStatus.Failed, ItemStatus.Cancelled] }) };
  },

  regenerate: async (event) => {
    const scope = await batchScope(event);
    const denied = await gated(scope.orgId);
    if (denied) {
      return denied;
    }
    const itemIds = idsOf(await event.request.formData());
    return { requeued: await requeueItems(scope.db, scope, { batchId: event.params.batchId, itemIds, from: [ItemStatus.Done] }) };
  },

  approve: async (event) => {
    const scope = await batchScope(event);
    const [itemId] = idsOf(await event.request.formData());
    await approveItem(scope.db, scope, { itemId, approval: Approval.Approved });
    return { ok: true };
  },

  reject: async (event) => {
    const scope = await batchScope(event);
    const [itemId] = idsOf(await event.request.formData());
    await approveItem(scope.db, scope, { itemId, approval: Approval.Rejected });
    return { ok: true };
  },

  calendar: async (event) => {
    const scope = await batchScope(event);
    const form = await event.request.formData();
    const date = String(form.get('date') ?? '');
    if (!ISO_DATE.test(date)) {
      return fail(HTTP_BAD_REQUEST, { error: 'Choose a day.' });
    }
    const outcome = await sendToCalendar(scope.db, scope, { batchId: scope.batch.id, brandId: String(form.get('brand_id') ?? ''), date });
    return 'error' in outcome ? fail(HTTP_UNPROCESSABLE, { error: outcome.error }) : { post: outcome.post };
  },

  drain: async (event) => {
    const scope = await batchScope(event);
    return { drained: await drainStudio(scope.db, { batchId: scope.batch.id }) };
  }
};
