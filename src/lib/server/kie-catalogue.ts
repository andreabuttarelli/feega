import type { AiModelRow } from './ai-models-sync';
import { KIE_CREDIT_USD } from './kie';
import { PER_RUN, type TaskPriceLine } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';
import type { WireFields } from './canvas/task-provider';
import { NANO_BANANA_2_MODEL, NANO_BANANA_PRO_MODEL } from '$lib/image-models';

export enum KieBilling {
  PerRun = 'per_run',
  PerSecond = 'per_second'
}

type KieModel = {
  kieModel: string;
  discountFor?: string;
  label: string;
  catalogue: 'image' | 'video';
  fields: WireFields;
  maxRefs: number;
  billing: KieBilling;
  creditsByResolution: Readonly<Record<string, number>>;
  defaultResolution: string;
  durations?: readonly number[];
  aspectRatios: readonly string[];
};

const NANO_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

const NANO_FIELDS: WireFields = { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', images: [], imageList: 'image_input' };

export const KIE_PRICE_SOURCE = 'https://api.kie.ai/client/v1/model-pricing/page';

export const KIE_MODELS: readonly KieModel[] = [
  {
    kieModel: 'nano-banana-2',
    discountFor: NANO_BANANA_2_MODEL,
    label: 'Nano Banana 2',
    catalogue: 'image',
    fields: NANO_FIELDS,
    maxRefs: 8,
    billing: KieBilling.PerRun,
    creditsByResolution: { '1K': 8, '2K': 12 },
    defaultResolution: '1K',
    aspectRatios: NANO_ASPECTS
  },
  {
    kieModel: 'nano-banana-pro',
    discountFor: NANO_BANANA_PRO_MODEL,
    label: 'Nano Banana Pro',
    catalogue: 'image',
    fields: NANO_FIELDS,
    maxRefs: 8,
    billing: KieBilling.PerRun,
    creditsByResolution: { '1K': 18 },
    defaultResolution: '1K',
    aspectRatios: NANO_ASPECTS
  },
  {
    kieModel: 'grok-imagine/text-to-video',
    label: 'Grok Imagine',
    catalogue: 'video',
    fields: { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', duration: 'duration', images: [] },
    maxRefs: 0,
    billing: KieBilling.PerSecond,
    creditsByResolution: { '480p': 2.4, '720p': 4.5, '1080p': 8 },
    defaultResolution: '480p',
    durations: [6, 10, 15, 20, 30],
    aspectRatios: ['9:16', '16:9', '1:1', '2:3', '3:2']
  }
];

export const kieUsdOfCredits = (credits: number): number => Math.round(credits * KIE_CREDIT_USD * 1e6) / 1e6;

function line(inputs: Record<string, string>, credits: number): TaskPriceLine {
  return { inputs, usd: kieUsdOfCredits(credits), method: PER_RUN };
}

const PRICE_LINES: Readonly<Record<KieBilling, (model: KieModel) => TaskPriceLine[]>> = {
  [KieBilling.PerRun]: (model) =>
    Object.entries(model.creditsByResolution).map(([resolution, credits]) => line({ [model.fields.resolution!]: resolution }, credits)),
  [KieBilling.PerSecond]: (model) =>
    Object.entries(model.creditsByResolution).flatMap(([resolution, perSecond]) =>
      (model.durations ?? []).map((seconds) => line({ [model.fields.resolution!]: resolution, [model.fields.duration!]: String(seconds) }, perSecond * seconds))
    )
};

function paramSchemaOf(model: KieModel): Record<string, unknown> {
  return {
    aspect_ratio: { type: 'enum', values: [...model.aspectRatios] },
    ...(model.durations ? { duration: { type: 'enum', values: model.durations.map(String) } } : {})
  };
}

function kieRow(model: KieModel, syncedAt: string): AiModelRow {
  const takesImages = model.fields.images.length > 0 || Boolean(model.fields.imageList);
  return {
    id: `${idPrefixOf(TaskProviderName.Kie)}${model.kieModel}`,
    catalogue: model.catalogue,
    provider: TaskProviderName.Kie,
    label: model.label,
    input_modalities: takesImages ? ['text', 'image'] : ['text'],
    output_modalities: [model.catalogue],
    supported_parameters: Object.values(model.fields).flat().filter((v): v is string => typeof v === 'string'),
    supported_resolutions: Object.keys(model.creditsByResolution),
    param_schema: paramSchemaOf(model),
    pricing: { lines: PRICE_LINES[model.billing](model) },
    synced_at: syncedAt,
    released_at: null,
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored: false,
    wire_spec: {
      model: model.kieModel,
      ...(model.discountFor ? { discountFor: model.discountFor } : {}),
      ...(model.durations ? { numeric: [model.fields.duration!] } : {}),
      defaults: { resolution: model.defaultResolution },
      maxRefs: model.maxRefs,
      fields: model.fields
    }
  };
}

export function kieModelRows(syncedAt: string): AiModelRow[] {
  return KIE_MODELS.map((model) => kieRow(model, syncedAt));
}
