import type { Db } from '$lib/server/db/client';
import { listCanvases, listNodes } from '$lib/server/repos/canvas';
import { listNodeProducts, type Product } from '$lib/server/repos/products';
import { listInfluencers, listInfluencerViewsByIds, signInfluencerViewFiles } from '$lib/server/repos/influencers';
import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { castingVerdict, isKidsProduct, ModelVerdict, MODEL_VERDICT_TEXT } from '$lib/studio/casting';

export const FIDELITY_MODEL = 'nano-banana-pro';
const FALLBACK_MAX_REFS = 3;

export type StudioProduct = {
  id: string;
  nodeId: string;
  title: string;
  image: string | null;
  imageCount: number;
  productType: string | null;
  tags: string[];
  kids: boolean;
  source: Product;
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

async function projectProducts(db: Db, scope: { orgId: string; projectId: string }): Promise<StudioProduct[]> {
  const canvases = await listCanvases(db, { orgId: scope.orgId, projectId: scope.projectId });
  const nodes = (await Promise.all(canvases.map((c) => listNodes(db, { orgId: scope.orgId, canvasId: c.id })))).flat();
  const productNodes = nodes.filter((n) => n.type === 'products' && !n.data.studio_batch_id);
  const perNode = await Promise.all(productNodes.map((n) => listNodeProducts(db, { orgId: scope.orgId, nodeId: n.id })));

  return perNode.flat().map((p) => ({
    id: p.id,
    nodeId: p.nodeId ?? '',
    title: p.title,
    image: p.images[0]?.url ?? null,
    imageCount: p.images.length,
    productType: p.productType,
    tags: p.tags,
    kids: isKidsProduct(p),
    source: p
  }));
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

export async function imageModels(): Promise<StudioImageModel[]> {
  const { choices } = (await canvasModelCatalogue()).image;
  return choices.flatMap((choice) => {
    const credits = creditsForRun({ medium: 'image', model: choice, params: {} });
    return credits === null ? [] : [{ id: choice.id, label: choice.label, credits, maxRefs: choice.maxRefs ?? FALLBACK_MAX_REFS }];
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
