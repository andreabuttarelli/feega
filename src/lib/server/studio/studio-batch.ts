import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createCanvas, createConnection, createNode } from '$lib/server/repos/canvas';
import { listNodeProducts, upsertNodeProducts } from '$lib/server/repos/products';
import { orgCreditBalance } from '$lib/server/credits';
import { nodeReferenceSchema } from '$lib/canvas/node-references';
import { newStudioBatchData } from '$lib/canvas/studio-batch-node';
import { Environment, ENVIRONMENTS } from '$lib/studio/environments';
import { Shot, SHOTS } from '$lib/studio/shots';
import { BATCH_MAX, cellKey, lockedPrompt, MAX_VARIATIONS, planBatch, previewItems, styleRefBudget, type BatchPlan, type PlannedItem } from '$lib/studio/plan';
import { Approval, creditCheck, ItemStatus, type CreditCheck } from '$lib/studio/batch-state';
import {
  BatchStatus,
  findBatch,
  insertBatch,
  insertItems,
  listItems,
  moveItems,
  setApproval,
  updateBatch,
  type Batch,
  type BatchItem,
  type BatchSpec
} from '$lib/server/repos/product-batches';
import type { StudioImageModel, StudioModel, StudioOptions, StudioProduct } from './studio-options';

export const STUDIO_AGENT_KEY = 'studio';
const ASPECT_RATIO = '3:4';
const CELL_SPACING_X = 420;
const CELL_SPACING_Y = 520;
const CELLS_PER_ROW = 6;

export const selectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  productIds: z.array(z.string()).min(1),
  modelIds: z.array(z.string()).default([]),
  environments: z.array(z.nativeEnum(Environment)).min(1),
  shots: z.array(z.nativeEnum(Shot)).min(1),
  variations: z.number().int().min(1).max(MAX_VARIATIONS),
  model: z.string().min(1),
  styleRefs: z.array(nodeReferenceSchema).default([]),
  noPeopleConfirmed: z.boolean().default(false)
});

export type Selection = z.infer<typeof selectionSchema>;

export type StudioCtx = { orgId: string; projectId: string; userId: string };

export type Quote = {
  plan: BatchPlan;
  model: StudioImageModel;
  previewModel: StudioImageModel;
  products: StudioProduct[];
  models: StudioModel[];
  droppedRefs: number;
  keptRefs: number;
};

export type StudioRefusal = { error: string };

function actorOf(ctx: StudioCtx): Actor {
  return { kind: 'agent', id: ctx.userId, agentKey: STUDIO_AGENT_KEY };
}

export function quoteSelection(selection: Selection, options: StudioOptions): Quote | StudioRefusal {
  const products = options.products.filter((p) => selection.productIds.includes(p.id));
  if (products.length !== selection.productIds.length) {
    return { error: 'Some products are no longer in this project.' };
  }

  const models = options.models.filter((m) => selection.modelIds.includes(m.id));
  const refused = models.find((m) => !m.allowed);
  if (models.length !== selection.modelIds.length || refused) {
    return { error: refused ? `${refused.name}: ${refused.why}` : 'Unknown model.' };
  }

  if (selection.styleRefs.length && !selection.noPeopleConfirmed) {
    return { error: 'Confirm the style references contain no people.' };
  }

  const model = options.imageModels.find((m) => m.id === selection.model);
  const previewModel = options.imageModels.find((m) => m.id === options.previewModel);
  if (!model || !previewModel) {
    return { error: 'This image model is not available.' };
  }

  const plan = planBatch({
    products: products.map((p, i) => ({ index: i + 1, title: p.title, productType: p.productType, tags: p.tags, imageCount: p.imageCount })),
    models: models.map((m) => ({ id: m.id, viewCount: m.viewCount })),
    environments: selection.environments,
    shots: selection.shots,
    variations: selection.variations
  });

  const budget = styleRefBudget({
    maxRefs: model.maxRefs,
    productImages: Math.max(...products.map((p) => p.imageCount), 0),
    modelViews: Math.max(...models.map((m) => m.viewCount), 0),
    styleRefs: selection.styleRefs.length
  });

  return { plan, model, previewModel, products, models, droppedRefs: budget.dropped, keptRefs: budget.kept };
}

export async function creditsFor(db: Db, orgId: string, perImage: number, count: number): Promise<CreditCheck> {
  return creditCheck(perImage, count, await orgCreditBalance(db, orgId));
}

async function copyProducts(db: Db, ctx: StudioCtx, canvasId: string, products: StudioProduct[], batchId: string): Promise<string> {
  const node = await createNode(db, {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    canvasId,
    type: 'products',
    x: 0,
    y: 0,
    displayName: 'Studio products',
    data: { type: products[0].source.platform, url: '', studio_batch_id: batchId },
    actor: actorOf(ctx)
  });

  for (const product of products) {
    const { source } = product;
    await upsertNodeProducts(db, {
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      nodeId: node.id,
      platform: source.platform,
      products: [{ ...source }]
    });
  }
  return node.id;
}

async function placeModels(db: Db, ctx: StudioCtx, canvasId: string, models: StudioModel[]): Promise<Record<string, string>> {
  const placed: Record<string, string> = {};
  for (const [i, model] of models.entries()) {
    const node = await createNode(db, {
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      canvasId,
      type: 'influencer',
      x: 0,
      y: CELL_SPACING_Y * (i + 1),
      displayName: model.name,
      data: { influencer_id: model.id },
      actor: actorOf(ctx)
    });
    placed[model.id] = node.id;
  }
  return placed;
}

async function placeSummary(db: Db, ctx: StudioCtx, canvasId: string, batch: { id: string; name: string }): Promise<void> {
  await createNode(db, {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    canvasId,
    type: 'studio_batch',
    x: 0,
    y: -CELL_SPACING_Y,
    displayName: batch.name,
    data: newStudioBatchData(batch.id),
    actor: actorOf(ctx)
  });
}

async function productIndexes(db: Db, orgId: string, productsNodeId: string, products: StudioProduct[]): Promise<Map<string, number>> {
  const copied = await listNodeProducts(db, { orgId, nodeId: productsNodeId });
  const byExternal = new Map(copied.map((p, i) => [`${p.platform}:${p.externalId}`, i + 1]));
  return new Map(products.map((p) => [p.id, byExternal.get(`${p.source.platform}:${p.source.externalId}`) ?? 0]));
}

async function ensureCells(db: Db, ctx: StudioCtx, batch: Batch, items: PlannedItem[], keptRefs: number): Promise<BatchSpec> {
  const spec = { ...batch.spec, cells: { ...batch.spec.cells } };
  const references = spec.styleRefs.slice(0, keptRefs);

  for (const item of items) {
    const key = cellKey(item);
    if (spec.cells[key]) {
      continue;
    }
    const at = Object.keys(spec.cells).length;
    const node = await createNode(db, {
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      canvasId: batch.canvasId!,
      type: 'image',
      x: CELL_SPACING_X * (1 + (at % CELLS_PER_ROW)),
      y: CELL_SPACING_Y * Math.floor(at / CELLS_PER_ROW),
      displayName: `${ENVIRONMENTS[item.environment].label} · ${SHOTS[item.shot].label}`,
      data: {
        prompt: lockedPrompt({ environment: item.environment, shot: item.shot, withModel: item.influencerId !== null, styleRefs: references.length }),
        model: batch.model,
        params: { aspectRatio: ASPECT_RATIO },
        references
      },
      actor: actorOf(ctx)
    });
    await createConnection(db, { orgId: ctx.orgId, canvasId: batch.canvasId!, sourceNodeId: batch.productsNodeId!, targetNodeId: node.id, mode: 'iterate', actor: actorOf(ctx) });
    const modelNode = item.influencerId ? spec.modelNodes[item.influencerId] : null;
    if (modelNode) {
      await createConnection(db, { orgId: ctx.orgId, canvasId: batch.canvasId!, sourceNodeId: modelNode, targetNodeId: node.id, actor: actorOf(ctx) });
    }
    spec.cells[key] = node.id;
  }

  await updateBatch(db, { orgId: ctx.orgId, batchId: batch.id, patch: { spec } });
  return spec;
}

async function enqueue(
  db: Db,
  ctx: StudioCtx,
  batch: Batch,
  quote: Quote,
  items: PlannedItem[],
  mode: { preview: boolean; model: string }
): Promise<BatchItem[]> {
  const spec = await ensureCells(db, ctx, batch, items, quote.keptRefs);
  const indexes = await productIndexes(db, ctx.orgId, batch.productsNodeId!, quote.products);
  const productAt = (index: number) => quote.products[index - 1];

  return insertItems(
    db,
    items.map((item) => ({
      orgId: ctx.orgId,
      batchId: batch.id,
      genNodeId: spec.cells[cellKey(item)],
      productIndex: indexes.get(productAt(item.productIndex).id) || item.productIndex,
      productTitle: item.productTitle,
      influencerId: item.influencerId,
      environment: item.environment,
      shot: item.shot,
      variation: item.variation,
      preview: mode.preview,
      model: mode.model
    }))
  );
}

export type StartOutcome = { batchId: string } | StudioRefusal;

export async function startPreview(db: Db, ctx: StudioCtx, selection: Selection, options: StudioOptions): Promise<StartOutcome> {
  const quote = quoteSelection(selection, options);
  if ('error' in quote) {
    return quote;
  }
  if (!quote.plan.items.length) {
    return { error: 'Nothing to generate with this selection.' };
  }
  if (quote.plan.overLimit) {
    return { error: `At most ${BATCH_MAX} images per batch: this one has ${quote.plan.items.length}.` };
  }

  const preview = previewItems(quote.plan.items);
  const credits = await creditsFor(db, ctx.orgId, quote.previewModel.credits, preview.length);
  if (!credits.enough) {
    return { error: `Not enough credits: the preview costs ${credits.total}, you have ${credits.balance}.` };
  }

  const spec: BatchSpec & { selection: Selection } = { styleRefs: selection.styleRefs, cells: {}, modelNodes: {}, droppedRefs: quote.droppedRefs, selection };
  const batch = await insertBatch(db, {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    name: selection.name,
    model: quote.model.id,
    previewModel: quote.previewModel.id,
    spec,
    actorId: ctx.userId
  });

  const canvas = await createCanvas(db, { orgId: ctx.orgId, projectId: ctx.projectId, name: `Studio · ${selection.name}` });
  const productsNodeId = await copyProducts(db, ctx, canvas.id, quote.products, batch.id);
  const modelNodes = await placeModels(db, ctx, canvas.id, quote.models);
  await placeSummary(db, ctx, canvas.id, { id: batch.id, name: selection.name });
  const materialised: Batch = { ...batch, canvasId: canvas.id, productsNodeId, spec: { ...spec, modelNodes } };
  await updateBatch(db, { orgId: ctx.orgId, batchId: batch.id, patch: { canvas_id: canvas.id, products_node_id: productsNodeId, spec: materialised.spec } });

  await enqueue(db, ctx, materialised, quote, preview, { preview: true, model: quote.previewModel.id });
  return { batchId: batch.id };
}

function selectionOf(batch: Batch): Selection | null {
  const parsed = selectionSchema.safeParse((batch.spec as BatchSpec & { selection?: unknown }).selection);
  return parsed.success ? parsed.data : null;
}

async function requote(db: Db, ctx: StudioCtx, batchId: string, options: StudioOptions, variations?: number) {
  const batch = await findBatch(db, { orgId: ctx.orgId, batchId });
  const selection = batch ? selectionOf(batch) : null;
  if (!batch || !selection) {
    return { error: 'Batch not found.' };
  }
  const quote = quoteSelection({ ...selection, variations: variations ?? selection.variations }, options);
  return 'error' in quote ? quote : { batch, quote };
}

export async function runBatch(db: Db, ctx: StudioCtx, batchId: string, options: StudioOptions): Promise<StartOutcome> {
  const found = await requote(db, ctx, batchId, options);
  if ('error' in found) {
    return found;
  }
  const { batch, quote } = found;
  const existing = await listItems(db, { orgId: ctx.orgId, batchId });
  if (existing.some((i) => !i.preview)) {
    return { error: 'This batch is already running.' };
  }

  const credits = await creditsFor(db, ctx.orgId, quote.model.credits, quote.plan.items.length);
  if (!credits.enough) {
    return { error: `Not enough credits: this batch costs ${credits.total}, you have ${credits.balance}.` };
  }

  await enqueue(db, ctx, batch, quote, quote.plan.items, { preview: false, model: quote.model.id });
  await updateBatch(db, { orgId: ctx.orgId, batchId, patch: { status: BatchStatus.Running } });
  return { batchId };
}

export async function moreVariations(db: Db, ctx: StudioCtx, batchId: string, options: StudioOptions, variations: number): Promise<StartOutcome> {
  const found = await requote(db, ctx, batchId, options, variations);
  if ('error' in found) {
    return found;
  }
  const { batch, quote } = found;
  const existing = (await listItems(db, { orgId: ctx.orgId, batchId })).filter((i) => !i.preview);
  const first = Math.max(0, ...existing.map((i) => i.variation)) + 1;
  const plan = planBatch({
    products: quote.products.map((p, i) => ({ index: i + 1, title: p.title, productType: p.productType, tags: p.tags, imageCount: p.imageCount })),
    models: quote.models.map((m) => ({ id: m.id, viewCount: m.viewCount })),
    environments: selectionOf(batch)!.environments,
    shots: selectionOf(batch)!.shots,
    variations,
    firstVariation: first
  });
  if (existing.length + plan.items.length > BATCH_MAX) {
    return { error: `At most ${BATCH_MAX} images per batch.` };
  }

  const credits = await creditsFor(db, ctx.orgId, quote.model.credits, plan.items.length);
  if (!credits.enough) {
    return { error: `Not enough credits: ${credits.total} needed, you have ${credits.balance}.` };
  }

  await enqueue(db, ctx, batch, quote, plan.items, { preview: false, model: quote.model.id });
  await updateBatch(db, { orgId: ctx.orgId, batchId, patch: { status: BatchStatus.Running } });
  return { batchId };
}

export async function cancelBatch(db: Db, ctx: StudioCtx, batchId: string): Promise<number> {
  const items = await listItems(db, { orgId: ctx.orgId, batchId });
  const moved = await moveItems(db, {
    orgId: ctx.orgId,
    itemIds: items.map((i) => i.id),
    from: [ItemStatus.Queued],
    patch: { status: ItemStatus.Cancelled }
  });
  await updateBatch(db, { orgId: ctx.orgId, batchId, patch: { status: BatchStatus.Cancelled } });
  return moved.length;
}

export async function requeueItems(db: Db, ctx: StudioCtx, input: { batchId: string; itemIds: string[]; from: ItemStatus[] }): Promise<number> {
  const moved = await moveItems(db, {
    orgId: ctx.orgId,
    itemIds: input.itemIds,
    from: input.from,
    patch: { status: ItemStatus.Queued, attempts: 0, error: null, approval: Approval.Pending, next_attempt_at: new Date().toISOString() }
  });
  if (moved.length) {
    await updateBatch(db, { orgId: ctx.orgId, batchId: input.batchId, patch: { status: BatchStatus.Running } });
  }
  return moved.length;
}

export async function approveItem(db: Db, ctx: StudioCtx, input: { itemId: string; approval: Approval }): Promise<void> {
  await setApproval(db, { orgId: ctx.orgId, itemId: input.itemId, approval: input.approval });
}
