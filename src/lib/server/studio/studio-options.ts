import type { Db } from '$lib/server/db/client';
import { listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { signedAssets } from './studio-media';
import { listNodeProducts, type Product } from '$lib/server/repos/products';
import { listInfluencers, listInfluencerViewsByIds, signInfluencerViewFiles } from '$lib/server/repos/influencers';
import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { creditsForRun } from '$lib/canvas/gen-cost';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { isKnownImageModelId } from '$lib/image-models';
import { castingVerdict, isKidsProduct, ModelVerdict, MODEL_VERDICT_TEXT } from '$lib/studio/casting';

export const FIDELITY_MODEL = 'nano-banana-pro';

export enum ProductOrigin {
  Store = 'store',
  Upload = 'upload'
}

export type ProductSource = { origin: ProductOrigin.Store; product: Product } | { origin: ProductOrigin.Upload; assetId: string };

export const UPLOAD_ID_PREFIX = 'upload:';

export type UploadItem = { asset_id: string; label: string };

export function isUploadsList(node: CanvasNodeRecord): boolean {
  return node.type === 'list' && node.data.studio_uploads === true;
}

export type StudioProduct = {
  id: string;
  nodeId: string;
  title: string;
  image: string | null;
  imageCount: number;
  productType: string | null;
  tags: string[];
  kids: boolean;
  source: ProductSource;
};

export type StudioModel = { id: string; name: string; age: number | null; cover: string | null; viewCount: number; allowed: boolean; why: string };

export type StudioImageModel = { id: string; label: string; credits: number; maxRefs: number };

export type StudioOptions = {
  products: StudioProduct[];
  models: StudioModel[];
  imageModels: StudioImageModel[];
  defaultModel: string;
  previewModel: string;
};

async function uploadedProducts(db: Db, orgId: string, nodes: CanvasNodeRecord[]): Promise<StudioProduct[]> {
  const items = nodes.filter(isUploadsList).flatMap((n) => (n.data.items ?? []) as UploadItem[]);
  const { urls } = await signedAssets(db, orgId, items.map((i) => i.asset_id), 'pickerTile');
  return items.reverse().map((item) => ({
    id: `${UPLOAD_ID_PREFIX}${item.asset_id}`,
    nodeId: '',
    title: item.label,
    image: urls[item.asset_id] ?? null,
    imageCount: 1,
    productType: null,
    tags: [],
    kids: false,
    source: { origin: ProductOrigin.Upload, assetId: item.asset_id }
  }));
}

async function projectProducts(db: Db, scope: { orgId: string; projectId: string }): Promise<StudioProduct[]> {
  const canvases = await listCanvases(db, { orgId: scope.orgId, projectId: scope.projectId });
  const nodes = (await Promise.all(canvases.map((c) => listNodes(db, { orgId: scope.orgId, canvasId: c.id })))).flat();
  const productNodes = nodes.filter((n) => n.type === 'products' && !n.data.studio_batch_id);
  const perNode = await Promise.all(productNodes.map((n) => listNodeProducts(db, { orgId: scope.orgId, nodeId: n.id })));

  const stored = perNode.flat().map((p) => ({
    id: p.id,
    nodeId: p.nodeId ?? '',
    title: p.title,
    image: p.images[0]?.url ?? null,
    imageCount: p.images.length,
    productType: p.productType,
    tags: p.tags,
    kids: isKidsProduct(p),
    source: { origin: ProductOrigin.Store as const, product: p }
  }));
  return [...(await uploadedProducts(db, scope.orgId, nodes)), ...stored];
}

async function castableModels(db: Db): Promise<StudioModel[]> {
  const influencers = await listInfluencers(db);
  const views = await listInfluencerViewsByIds(db, influencers.map((i) => i.id));
  const covers = influencers.map((i) => views.get(i.id)?.[0]?.storagePath).filter((p): p is string => Boolean(p));
  const signed = await signInfluencerViewFiles(db, covers);

  return influencers.map((i) => {
    const verdict = castingVerdict({ orgId: i.orgId, source: i.source, age: i.age });
    const cover = views.get(i.id)?.[0]?.storagePath;
    return {
      id: i.id,
      name: i.name,
      age: i.age,
      cover: cover ? (signed.get(cover) ?? null) : null,
      viewCount: views.get(i.id)?.length ?? 0,
      allowed: verdict === ModelVerdict.Allowed,
      why: MODEL_VERDICT_TEXT[verdict]
    };
  });
}

export function acceptsProductPhoto(choice: Pick<ModelChoice, 'id' | 'inputModalities' | 'maxRefs'>): boolean {
  return isKnownImageModelId(choice.id) && (choice.inputModalities ?? []).includes('image') && (choice.maxRefs ?? 0) > 0;
}

export async function imageModels(): Promise<StudioImageModel[]> {
  const { choices } = (await canvasModelCatalogue()).image;
  return choices.filter(acceptsProductPhoto).flatMap((choice) => {
    const credits = creditsForRun({ medium: 'image', model: choice, params: {} });
    return credits === null ? [] : [{ id: choice.id, label: choice.label, credits, maxRefs: choice.maxRefs ?? 0 }];
  });
}

export function cheapest(models: StudioImageModel[]): StudioImageModel | null {
  return models.reduce<StudioImageModel | null>((best, m) => (!best || m.credits < best.credits ? m : best), null);
}

export async function studioOptions(db: Db, scope: { orgId: string; projectId: string }): Promise<StudioOptions> {
  const [products, models, imageChoices] = await Promise.all([projectProducts(db, scope), castableModels(db), imageModels()]);
  const preview = cheapest(imageChoices);
  const fidelity = imageChoices.find((m) => m.id === FIDELITY_MODEL) ?? imageChoices[0];
  return {
    products,
    models,
    imageModels: imageChoices,
    defaultModel: fidelity?.id ?? '',
    previewModel: preview?.id ?? ''
  };
}
