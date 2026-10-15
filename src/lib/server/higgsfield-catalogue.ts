import type { AiModelRow } from './ai-models-sync';
import type { WireFields } from './canvas/task-provider';
import { higgsfieldEstimate, type HiggsfieldConfig } from './higgsfield';
import { PER_RUN, type TaskPriceLine } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';

type Variant = { key: string; values: readonly (string | number)[] };

type HiggsfieldModel = {
  path: string;
  label: string;
  catalogue: 'image' | 'video';
  fields: WireFields;
  numeric: readonly string[];
  priceBy: Variant;
  schema: Readonly<Record<string, readonly (string | number)[]>>;
  estimateBase: Readonly<Record<string, unknown>>;
};

const ESTIMATE_PROMPT = 'price estimate';
const ESTIMATE_IMAGE = 'https://higgsfield.ai/estimate.png';
const SOUL_ASPECTS = ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9'];

const TEXT_TO_VIDEO: WireFields = { prompt: 'prompt', duration: 'duration', images: [] };
const IMAGE_TO_VIDEO: WireFields = { prompt: 'prompt', duration: 'duration', images: ['image_url'] };

export const HIGGSFIELD_MODELS: readonly HiggsfieldModel[] = [
  {
    path: 'higgsfield-ai/soul/standard',
    label: 'Higgsfield Soul',
    catalogue: 'image',
    fields: { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', images: [] },
    numeric: [],
    priceBy: { key: 'resolution', values: ['2K', '4K'] },
    schema: { aspect_ratio: SOUL_ASPECTS },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'kling-video/v2.5-turbo/pro/text-to-video',
    label: 'Kling 2.5 Turbo Pro',
    catalogue: 'video',
    fields: TEXT_TO_VIDEO,
    numeric: ['duration'],
    priceBy: { key: 'duration', values: [5, 10] },
    schema: { duration: [5, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'kling-video/v2.5-turbo/pro/image-to-video',
    label: 'Kling 2.5 Turbo Pro · from image',
    catalogue: 'video',
    fields: IMAGE_TO_VIDEO,
    numeric: ['duration'],
    priceBy: { key: 'duration', values: [5, 10] },
    schema: { duration: [5, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_url: ESTIMATE_IMAGE }
  },
  {
    path: 'minimax/hailuo-2.3/standard/text-to-video',
    label: 'Hailuo 2.3',
    catalogue: 'video',
    fields: TEXT_TO_VIDEO,
    numeric: ['duration'],
    priceBy: { key: 'duration', values: [6, 10] },
    schema: { duration: [6, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'minimax/hailuo-2.3/standard/image-to-video',
    label: 'Hailuo 2.3 · from image',
    catalogue: 'video',
    fields: IMAGE_TO_VIDEO,
    numeric: ['duration'],
    priceBy: { key: 'duration', values: [6, 10] },
    schema: { duration: [6, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_url: ESTIMATE_IMAGE }
  }
];

export type Estimate = (path: string, inputs: Record<string, unknown>) => Promise<number | null>;

async function priceLines(model: HiggsfieldModel, estimate: Estimate): Promise<TaskPriceLine[] | null> {
  const lines = await Promise.all(
    model.priceBy.values.map(async (value) => {
      const usd = await estimate(model.path, { ...model.estimateBase, [model.priceBy.key]: value });
      return usd === null ? null : { inputs: { [model.priceBy.key]: String(value) }, usd, method: PER_RUN };
    })
  );
  return lines.every((line) => line !== null) ? (lines as TaskPriceLine[]) : null;
}

function schemaOf(model: HiggsfieldModel): Record<string, unknown> {
  return Object.fromEntries(Object.entries(model.schema).map(([key, values]) => [key, { type: 'enum', values: values.map(String) }]));
}

function higgsfieldRow(model: HiggsfieldModel, lines: TaskPriceLine[], syncedAt: string): AiModelRow {
  return {
    id: `${idPrefixOf(TaskProviderName.Higgsfield)}${model.path}`,
    catalogue: model.catalogue,
    provider: TaskProviderName.Higgsfield,
    label: model.label,
    input_modalities: model.fields.images.length ? ['text', 'image'] : ['text'],
    output_modalities: [model.catalogue],
    supported_parameters: Object.values(model.fields).flat().filter((v): v is string => typeof v === 'string'),
    supported_resolutions: model.priceBy.key === 'resolution' ? model.priceBy.values.map(String) : [],
    param_schema: schemaOf(model),
    pricing: { lines },
    synced_at: syncedAt,
    released_at: null,
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored: false,
    wire_spec: { path: model.path, numeric: [...model.numeric], fields: model.fields }
  };
}

export async function higgsfieldModelRows(estimate: Estimate, syncedAt: string): Promise<{ rows: AiModelRow[]; ok: boolean; reason?: string }> {
  try {
    const priced = await Promise.all(HIGGSFIELD_MODELS.map(async (model) => ({ model, lines: await priceLines(model, estimate) })));
    const rows = priced.filter((p) => p.lines !== null).map((p) => higgsfieldRow(p.model, p.lines!, syncedAt));
    return { rows, ok: true };
  } catch (error) {
    return { rows: [], ok: false, reason: error instanceof Error ? error.message : 'higgsfield estimate failed' };
  }
}

export function estimateWith(config: HiggsfieldConfig): Estimate {
  return (path, inputs) => higgsfieldEstimate(config, path, inputs);
}
