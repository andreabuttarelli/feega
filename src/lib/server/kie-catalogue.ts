import type { AiModelRow } from './ai-models-sync';
import { KIE_CREDIT_USD } from './kie';
import { PER_RUN } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';
import type { WireFields } from './canvas/task-provider';
import { NANO_BANANA_2_MODEL, NANO_BANANA_PRO_MODEL } from '$lib/image-models';

type KieModel = {
  kieModel: string;
  discountFor: string;
  label: string;
  catalogue: 'image' | 'video';
  fields: WireFields;
  maxRefs: number;
  creditsByResolution: Readonly<Record<string, number>>;
  defaultResolution: string;
  aspectRatios: readonly string[];
};

const NANO_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

const NANO_FIELDS: WireFields = { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', images: [], imageList: 'image_input' };

export const KIE_MODELS: readonly KieModel[] = [
  {
    kieModel: 'nano-banana-2',
    discountFor: NANO_BANANA_2_MODEL,
    label: 'Nano Banana 2',
    catalogue: 'image',
    fields: NANO_FIELDS,
    maxRefs: 8,
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
    creditsByResolution: { '1K': 18 },
    defaultResolution: '1K',
    aspectRatios: NANO_ASPECTS
  }
];

export const kieUsdOfCredits = (credits: number): number => Math.round(credits * KIE_CREDIT_USD * 1e6) / 1e6;

function kieRow(model: KieModel, syncedAt: string): AiModelRow {
  const resolutions = Object.keys(model.creditsByResolution);
  return {
    id: `${idPrefixOf(TaskProviderName.Kie)}${model.kieModel}`,
    catalogue: model.catalogue,
    provider: TaskProviderName.Kie,
    label: model.label,
    input_modalities: ['text', 'image'],
    output_modalities: [model.catalogue],
    supported_parameters: Object.values(model.fields).flat().filter((v): v is string => typeof v === 'string'),
    supported_resolutions: resolutions,
    param_schema: { aspect_ratio: { type: 'enum', values: [...model.aspectRatios] } },
    pricing: {
      lines: Object.entries(model.creditsByResolution).map(([resolution, credits]) => ({
        inputs: { [model.fields.resolution!]: resolution },
        usd: kieUsdOfCredits(credits),
        method: PER_RUN
      }))
    },
    synced_at: syncedAt,
    released_at: null,
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored: false,
    wire_spec: {
      model: model.kieModel,
      discountFor: model.discountFor,
      defaults: { resolution: model.defaultResolution },
      maxRefs: model.maxRefs,
      fields: model.fields
    }
  };
}

export function kieModelRows(syncedAt: string): AiModelRow[] {
  return KIE_MODELS.map((model) => kieRow(model, syncedAt));
}
