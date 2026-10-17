import type { AiModelRow } from './ai-models-sync';
import type { WireFields } from './canvas/task-provider';
import type { TaskWireSpec } from './canvas/task-run';
import { higgsfieldEstimate, higgsfieldOptions, type HiggsfieldConfig, type HiggsfieldOption } from './higgsfield';
import { PER_RUN, type TaskPriceLine } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';

type Variant = { key: string; values: readonly (string | number)[] };

export type HiggsfieldModel = {
  path: string;
  label: string;
  catalogue: 'image' | 'video';
  fields: WireFields;
  numeric: readonly string[];
  priceBy: readonly Variant[];
  schema: Readonly<Record<string, readonly (string | number)[]>>;
  estimateBase: Readonly<Record<string, unknown>>;
  resolutions?: readonly string[];
  options?: { param: string; path: string };
  wire?: Pick<TaskWireSpec, 'requiresImage' | 'requiresVideo' | 'caps' | 'quotedAtSubmit' | 'requiredParams' | 'menuGroup'>;
};

const ESTIMATE_PROMPT = 'price estimate';
const ESTIMATE_IMAGE = 'https://higgsfield.ai/estimate.png';
const SOUL_ASPECTS = ['9:16', '16:9', '4:3', '3:4', '1:1', '2:3', '3:2'];

const ESTIMATE_VIDEO = 'https://higgsfield.ai/estimate.mp4';

const SEEDANCE_PATH = 'bytedance/seedance-2.5';
const SEEDANCE_DURATIONS = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const SEEDANCE_RESOLUTIONS = ['480p', '720p', '1080p'];
const SEEDANCE_ASPECTS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
const SEEDANCE_SIZES = [
  { key: 'duration', values: SEEDANCE_DURATIONS },
  { key: 'resolution', values: SEEDANCE_RESOLUTIONS }
];
const SEEDANCE_REF_CAPS = { image: 30, video: 10, audio: 10 };
const SEEDANCE_SOURCE_CAPS = { ...SEEDANCE_REF_CAPS, video: 9 };
const SEEDANCE_REFERENCES = { imageList: 'image_urls', videoList: 'video_urls', audioList: 'audio_urls' };
const SEEDANCE_ON_SOURCE: WireFields = { prompt: 'prompt', resolution: 'resolution', images: [], video: 'video_url', ...SEEDANCE_REFERENCES };

const seedance = (mode: string, label: string, model: Omit<HiggsfieldModel, 'path' | 'label' | 'catalogue' | 'numeric'>): HiggsfieldModel => ({
  path: `${SEEDANCE_PATH}/${mode}`,
  label: `Seedance 2.5 · ${label}`,
  catalogue: 'video',
  numeric: ['duration'],
  ...model
});

const SEEDANCE_MODELS: readonly HiggsfieldModel[] = [
  seedance('text-to-video', 'from text', {
    fields: { prompt: 'prompt', duration: 'duration', resolution: 'resolution', aspectRatio: 'aspect_ratio', images: [] },
    priceBy: SEEDANCE_SIZES,
    schema: { duration: SEEDANCE_DURATIONS, aspect_ratio: SEEDANCE_ASPECTS },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  }),
  seedance('image-to-video', 'from image', {
    fields: { prompt: 'prompt', duration: 'duration', resolution: 'resolution', images: ['image_url'], lastFrame: 'end_image_url' },
    priceBy: SEEDANCE_SIZES,
    schema: { duration: SEEDANCE_DURATIONS },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_url: ESTIMATE_IMAGE },
    wire: { requiresImage: true }
  }),
  seedance('reference-to-video', 'from references', {
    fields: { prompt: 'prompt', duration: 'duration', resolution: 'resolution', aspectRatio: 'aspect_ratio', images: [], ...SEEDANCE_REFERENCES },
    priceBy: SEEDANCE_SIZES,
    schema: { duration: SEEDANCE_DURATIONS, aspect_ratio: SEEDANCE_ASPECTS },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_urls: [ESTIMATE_IMAGE] },
    wire: { caps: SEEDANCE_REF_CAPS }
  }),
  seedance('video-edit', 'edit video', {
    fields: SEEDANCE_ON_SOURCE,
    priceBy: [],
    resolutions: SEEDANCE_RESOLUTIONS,
    schema: {},
    estimateBase: {},
    wire: { requiresVideo: true, caps: SEEDANCE_SOURCE_CAPS, quotedAtSubmit: true }
  }),
  seedance('video-extend', 'extend video', {
    fields: { ...SEEDANCE_ON_SOURCE, duration: 'duration' },
    priceBy: SEEDANCE_SIZES,
    schema: { duration: SEEDANCE_DURATIONS },
    estimateBase: { prompt: ESTIMATE_PROMPT, video_url: ESTIMATE_VIDEO },
    wire: { requiresVideo: true, caps: SEEDANCE_SOURCE_CAPS }
  })
];

const TRANSFORM_VIDEO = 'Transform video';
const GENJUTSU_RESOLUTIONS = ['480p', '720p', '1080p'];
const GENJUTSU_FIELDS: WireFields = { prompt: 'prompt', resolution: 'resolution', images: [], video: 'video_url', imageList: 'image_urls' };
const RESTYLE_PATH = 'higgsfield/genjutsu/restyle/v1.0';

const genjutsu = (mode: string, label: string, wire: HiggsfieldModel['wire'], extra: Partial<HiggsfieldModel> = {}): HiggsfieldModel => ({
  path: `higgsfield/genjutsu/${mode}/v1.0`,
  label: `${TRANSFORM_VIDEO} · ${label}`,
  catalogue: 'video',
  fields: GENJUTSU_FIELDS,
  numeric: [],
  priceBy: [],
  resolutions: GENJUTSU_RESOLUTIONS,
  schema: {},
  estimateBase: {},
  wire: { requiresVideo: true, quotedAtSubmit: true, menuGroup: TRANSFORM_VIDEO, ...wire },
  ...extra
});

const GENJUTSU_MODELS: readonly HiggsfieldModel[] = [
  genjutsu('motion-transfer', 'motion transfer', { requiresImage: true, caps: { image: 8 } }),
  genjutsu('object-swap', 'object swap', { requiresImage: true, caps: { image: 8 } }),
  genjutsu('restyle', 'restyle', { caps: { image: 5 }, requiredParams: ['preset_id'] }, { options: { param: 'preset_id', path: `models/${RESTYLE_PATH}/presets` } })
];

const TEXT_TO_VIDEO: WireFields = { prompt: 'prompt', duration: 'duration', images: [] };
const IMAGE_TO_VIDEO: WireFields = { prompt: 'prompt', duration: 'duration', images: ['image_url'] };

export const HIGGSFIELD_MODELS: readonly HiggsfieldModel[] = [
  {
    path: 'higgsfield-ai/soul/standard',
    label: 'Higgsfield Soul',
    catalogue: 'image',
    fields: { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', images: [] },
    numeric: [],
    priceBy: [{ key: 'resolution', values: ['720p', '1080p'] }],
    schema: { aspect_ratio: SOUL_ASPECTS },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'kling-video/v2.5-turbo/pro/text-to-video',
    label: 'Kling 2.5 Turbo Pro',
    catalogue: 'video',
    fields: TEXT_TO_VIDEO,
    numeric: ['duration'],
    priceBy: [{ key: 'duration', values: [5, 10] }],
    schema: { duration: [5, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'kling-video/v2.5-turbo/pro/image-to-video',
    label: 'Kling 2.5 Turbo Pro · from image',
    catalogue: 'video',
    fields: IMAGE_TO_VIDEO,
    numeric: ['duration'],
    priceBy: [{ key: 'duration', values: [5, 10] }],
    schema: { duration: [5, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_url: ESTIMATE_IMAGE }
  },
  {
    path: 'minimax/hailuo-2.3/standard/text-to-video',
    label: 'Hailuo 2.3',
    catalogue: 'video',
    fields: TEXT_TO_VIDEO,
    numeric: ['duration'],
    priceBy: [{ key: 'duration', values: [6, 10] }],
    schema: { duration: [6, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT }
  },
  {
    path: 'minimax/hailuo-2.3/standard/image-to-video',
    label: 'Hailuo 2.3 · from image',
    catalogue: 'video',
    fields: IMAGE_TO_VIDEO,
    numeric: ['duration'],
    priceBy: [{ key: 'duration', values: [6, 10] }],
    schema: { duration: [6, 10] },
    estimateBase: { prompt: ESTIMATE_PROMPT, image_url: ESTIMATE_IMAGE }
  },
  ...SEEDANCE_MODELS,
  ...GENJUTSU_MODELS
];

export type Estimate = (path: string, inputs: Record<string, unknown>) => Promise<number | null>;

export type CatalogueSource = { estimate: Estimate; options?: (path: string) => Promise<HiggsfieldOption[]> };

const NO_LINES: TaskPriceLine[] = [];

type Pair = Record<string, string | number>;

function pairsOf(variants: readonly Variant[]): Pair[] {
  return variants.reduce<Pair[]>((pairs, variant) => pairs.flatMap((pair) => variant.values.map((value) => ({ ...pair, [variant.key]: value }))), [{}]);
}

const asWire = (pair: Pair): Record<string, string> => Object.fromEntries(Object.entries(pair).map(([key, value]) => [key, String(value)]));

async function priceLines(model: HiggsfieldModel, estimate: Estimate): Promise<TaskPriceLine[] | null> {
  if (model.wire?.quotedAtSubmit) {
    return NO_LINES;
  }
  const lines = await Promise.all(
    pairsOf(model.priceBy).map(async (pair) => {
      const usd = await estimate(model.path, { ...model.estimateBase, ...pair });
      return usd === null ? null : { inputs: asWire(pair), usd, method: PER_RUN };
    })
  );
  return lines.every((line) => line !== null) ? (lines as TaskPriceLine[]) : null;
}

const resolutionsOf = (model: HiggsfieldModel): string[] =>
  [...(model.resolutions ?? model.priceBy.find((variant) => variant.key === 'resolution')?.values ?? [])].map(String);

function optionSchema(model: HiggsfieldModel, options: HiggsfieldOption[]): Record<string, unknown> {
  if (!model.options) {
    return {};
  }
  return { [model.options.param]: { type: 'enum', values: options.map((o) => o.id), labels: Object.fromEntries(options.map((o) => [o.id, o.name])) } };
}

function schemaOf(model: HiggsfieldModel, options: HiggsfieldOption[]): Record<string, unknown> {
  const enums = Object.fromEntries(Object.entries(model.schema).map(([key, values]) => [key, { type: 'enum', values: values.map(String) }]));
  return { ...enums, ...optionSchema(model, options) };
}

async function optionsOf(model: HiggsfieldModel, source: CatalogueSource): Promise<HiggsfieldOption[] | null> {
  if (!model.options) {
    return [];
  }
  const options = (await source.options?.(model.options.path)) ?? [];
  return options.length ? options : null;
}

const MODALITY_FIELDS: ReadonlyArray<[string, (fields: WireFields) => boolean]> = [
  ['text', (f) => Boolean(f.prompt)],
  ['image', (f) => f.images.length > 0 || Boolean(f.imageList)],
  ['video', (f) => Boolean(f.video || f.videoList)],
  ['audio', (f) => Boolean(f.audioList)]
];

const modalitiesOf = (fields: WireFields): string[] => MODALITY_FIELDS.filter(([, takes]) => takes(fields)).map(([modality]) => modality);

function higgsfieldRow(model: HiggsfieldModel, priced: { lines: TaskPriceLine[]; options: HiggsfieldOption[] }, syncedAt: string): AiModelRow {
  return {
    id: `${idPrefixOf(TaskProviderName.Higgsfield)}${model.path}`,
    catalogue: model.catalogue,
    provider: TaskProviderName.Higgsfield,
    label: model.label,
    input_modalities: modalitiesOf(model.fields),
    output_modalities: [model.catalogue],
    supported_parameters: Object.values(model.fields).flat().filter((v): v is string => typeof v === 'string'),
    supported_resolutions: resolutionsOf(model),
    param_schema: schemaOf(model, priced.options),
    pricing: { lines: priced.lines },
    synced_at: syncedAt,
    released_at: null,
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored: false,
    wire_spec: { path: model.path, numeric: [...model.numeric], fields: model.fields, ...model.wire }
  };
}

export async function higgsfieldModelRows(
  source: CatalogueSource,
  syncedAt: string,
  models: readonly HiggsfieldModel[] = HIGGSFIELD_MODELS
): Promise<{ rows: AiModelRow[]; ok: boolean; reason?: string }> {
  try {
    const priced = await Promise.all(
      models.map(async (model) => ({ model, lines: await priceLines(model, source.estimate), options: await optionsOf(model, source) }))
    );
    const rows = priced
      .filter((p) => p.lines !== null && p.options !== null)
      .map((p) => higgsfieldRow(p.model, { lines: p.lines!, options: p.options! }, syncedAt));
    return { rows, ok: true };
  } catch (error) {
    return { rows: [], ok: false, reason: error instanceof Error ? error.message : 'higgsfield estimate failed' };
  }
}

export function sourceWith(config: HiggsfieldConfig): CatalogueSource {
  return {
    estimate: (path, inputs) => higgsfieldEstimate(config, path, inputs),
    options: (path) => higgsfieldOptions(config, path).catch(() => [])
  };
}
