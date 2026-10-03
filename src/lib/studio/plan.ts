import { ENVIRONMENTS, type Environment } from './environments';
import { Casting, SHOTS, type Shot } from './shots';
import { isKidsProduct, type ProductFacts } from './casting';

export const BATCH_MAX = 200;
export const PREVIEW_SIZE = 3;
export const MAX_VARIATIONS = 8;

export type PlanProduct = ProductFacts & { index: number; imageCount: number };
export type PlanModel = { id: string; viewCount: number };

export type PlanInput = {
  products: PlanProduct[];
  models: PlanModel[];
  environments: Environment[];
  shots: Shot[];
  variations: number;
  firstVariation?: number;
};

export type PlannedItem = {
  productIndex: number;
  productTitle: string;
  influencerId: string | null;
  environment: Environment;
  shot: Shot;
  variation: number;
};

export enum SkipReason {
  NoModelPicked = 'no_model_picked',
  KidsProduct = 'kids_product'
}

export const SKIP_TEXT: Readonly<Record<SkipReason, string>> = {
  [SkipReason.NoModelPicked]: 'on-model shot without a model',
  [SkipReason.KidsProduct]: "kids' product: packshot and detail only"
};

export type Skipped = { productTitle: string; shot: Shot; reason: SkipReason };

export type BatchPlan = { items: PlannedItem[]; skipped: Skipped[]; overLimit: boolean };

function castFor(product: PlanProduct, shot: Shot, models: PlanModel[]): { models: (string | null)[] } | { reason: SkipReason } {
  const rule = SHOTS[shot];
  if (rule.casting === Casting.NoPerson) {
    return { models: [null] };
  }
  if (isKidsProduct(product)) {
    return { reason: SkipReason.KidsProduct };
  }
  if (!models.length) {
    return { reason: SkipReason.NoModelPicked };
  }
  return { models: models.map((m) => m.id) };
}

export function planBatch(input: PlanInput): BatchPlan {
  const items: PlannedItem[] = [];
  const skipped: Skipped[] = [];
  const first = input.firstVariation ?? 1;
  const variations = Math.min(Math.max(1, Math.round(input.variations)), MAX_VARIATIONS);

  for (const product of input.products) {
    for (const shot of input.shots) {
      const cast = castFor(product, shot, input.models);
      if ('reason' in cast) {
        skipped.push({ productTitle: product.title, shot, reason: cast.reason });
        continue;
      }
      for (const environment of input.environments) {
        for (const influencerId of cast.models) {
          for (let v = 0; v < variations; v++) {
            items.push({ productIndex: product.index, productTitle: product.title, influencerId, environment, shot, variation: first + v });
          }
        }
      }
    }
  }

  return { items, skipped, overLimit: items.length > BATCH_MAX };
}

export function previewItems(items: PlannedItem[]): PlannedItem[] {
  const onePerProduct = items.filter((item, i) => items.findIndex((other) => other.productIndex === item.productIndex) === i);
  const rest = items.filter((item) => !onePerProduct.includes(item));
  return [...onePerProduct, ...rest].slice(0, PREVIEW_SIZE);
}

export function cellKey(item: Pick<PlannedItem, 'environment' | 'shot' | 'influencerId'>): string {
  return `${item.environment}|${item.shot}|${item.influencerId ?? '-'}`;
}

const FIDELITY =
  'Preserve the product exactly as in its reference photo: same shape, proportions, colour, material, logo and label text. Do not add any text, watermark or extra logo.';

export function lockedPrompt(input: { environment: Environment; shot: Shot; withModel: boolean; styleRefs: number }): string {
  const parts = [
    `Professional e-commerce catalogue photograph. ${SHOTS[input.shot].framing}.`,
    `Scene: ${ENVIRONMENTS[input.environment].scene}.`,
    FIDELITY
  ];
  if (input.withModel) {
    parts.push('The person is the adult model shown in the model reference views: keep the same face, body and look.');
  }
  if (input.styleRefs > 0) {
    parts.push('Use the style references only for scene, light and colour mood; never copy any person from them.');
  }
  return parts.join(' ');
}

export type RefBudget = { kept: number; dropped: number };

export function styleRefBudget(input: { maxRefs: number; productImages: number; modelViews: number; styleRefs: number }): RefBudget {
  const room = Math.max(input.maxRefs - input.productImages - input.modelViews, 0);
  const kept = Math.min(room, input.styleRefs);
  return { kept, dropped: input.styleRefs - kept };
}
