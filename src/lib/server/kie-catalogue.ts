import type { AiModelRow } from './ai-models-sync';
import { KIE_CREDIT_USD } from './kie';
import { creditsBy, KieUnit, modelKeyOf, type KieLine, type KiePrices } from './kie-pricing';
import type { KieSpec } from './kie-docs';
import { PER_RUN, type TaskPriceLine } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';
import type { WireFields } from './canvas/task-provider';
import { GPT_IMAGE_2_MODEL, GPT_IMAGE_25_SUNBURST_MODEL, NANO_BANANA_2_MODEL, NANO_BANANA_PRO_MODEL, QWEN3_PRO_MODEL } from '$lib/image-models';
import { IMAGE_TOOLS_GROUP, IMAGE_TOOL_MODEL, ImageTool } from '$lib/image-tools';

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
  defaultResolution: string;
  durations?: readonly number[];
  aspectRatios: readonly string[];
  numeric?: boolean;
};

type PricedKieModel = KieModel & { creditsByResolution: Readonly<Record<string, number>> };

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
    billing: KieBilling.PerRun,
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
    defaultResolution: '480p',
    durations: [6, 10, 15, 20, 30],
    numeric: true,
    aspectRatios: ['9:16', '16:9', '1:1', '2:3', '3:2']
  }
];

export const kieUsdOfCredits = (credits: number): number => Math.round(credits * KIE_CREDIT_USD * 1e6) / 1e6;

const NO_RESOLUTION = '';

const OPENROUTER_TWINS: Readonly<Record<string, string>> = {
  'gpt-image-2-text-to-image': GPT_IMAGE_2_MODEL,
  'gpt-image-2-5-sunburst-text-to-image': GPT_IMAGE_25_SUNBURST_MODEL,
  'qwen3/pro-text-to-image': QWEN3_PRO_MODEL
};

const BILLING_UNITS: Readonly<Record<KieBilling, readonly KieUnit[]>> = {
  [KieBilling.PerRun]: [KieUnit.Image, KieUnit.Generation, KieUnit.Video],
  [KieBilling.PerSecond]: [KieUnit.Second]
};

function line(inputs: Record<string, string>, credits: number): TaskPriceLine {
  return { inputs, usd: kieUsdOfCredits(credits), method: PER_RUN };
}

function resolutionInputs(model: KieModel, resolution: string): Record<string, string> {
  return resolution === NO_RESOLUTION || !model.fields.resolution ? {} : { [model.fields.resolution]: resolution };
}

const PRICE_LINES: Readonly<Record<KieBilling, (model: PricedKieModel) => TaskPriceLine[]>> = {
  [KieBilling.PerRun]: (model) => Object.entries(model.creditsByResolution).map(([resolution, credits]) => line(resolutionInputs(model, resolution), credits)),
  [KieBilling.PerSecond]: (model) =>
    Object.entries(model.creditsByResolution).flatMap(([resolution, perSecond]) =>
      (model.durations ?? []).map((seconds) => line({ ...resolutionInputs(model, resolution), [model.fields.duration!]: String(seconds) }, perSecond * seconds))
    )
};

function pricedModel(model: KieModel, prices: KiePrices): PricedKieModel | null {
  const lines = prices.get(modelKeyOf(model.kieModel))?.lines ?? [];
  const creditsByResolution = creditsBy(lines, BILLING_UNITS[model.billing], (l) => l.resolution ?? NO_RESOLUTION);
  return Object.keys(creditsByResolution).length ? { ...model, creditsByResolution } : null;
}

function paramSchemaOf(model: KieModel): Record<string, unknown> {
  return {
    ...(model.aspectRatios.length ? { aspect_ratio: { type: 'enum', values: [...model.aspectRatios] } } : {}),
    ...(model.durations ? { duration: { type: 'enum', values: model.durations.map(String) } } : {})
  };
}

function kieRow(model: PricedKieModel, syncedAt: string): AiModelRow {
  const takesImages = model.fields.images.length > 0 || Boolean(model.fields.imageList);
  const resolutions = Object.keys(model.creditsByResolution).filter((resolution) => resolution !== NO_RESOLUTION);
  return {
    id: `${idPrefixOf(TaskProviderName.Kie)}${model.kieModel}`,
    catalogue: model.catalogue,
    provider: TaskProviderName.Kie,
    label: model.label,
    input_modalities: takesImages ? ['text', 'image'] : ['text'],
    output_modalities: [model.catalogue],
    supported_parameters: Object.values(model.fields).flat().filter((v): v is string => typeof v === 'string'),
    supported_resolutions: resolutions,
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
      ...(model.numeric ? { numeric: [model.fields.duration!] } : {}),
      defaults: model.defaultResolution === NO_RESOLUTION ? {} : { resolution: model.defaultResolution },
      maxRefs: model.maxRefs,
      fields: model.fields
    }
  };
}

function enumSpelling(resolution: string, allowed: readonly string[]): string | null {
  return allowed.find((value) => value.toLowerCase() === resolution.toLowerCase()) ?? null;
}

function discovered(spec: KieSpec, prices: KiePrices): PricedKieModel | null {
  const found = prices.get(modelKeyOf(spec.model));
  const catalogue = found?.catalogue;
  if (!found || (catalogue !== 'image' && catalogue !== 'video')) {
    return null;
  }
  const perSecond = found.lines.some((l) => l.unit === KieUnit.Second);
  const billing = perSecond ? KieBilling.PerSecond : KieBilling.PerRun;
  if (perSecond && !(spec.fields.duration && spec.durations.length)) {
    return null;
  }
  const spelled = (l: KieLine): string | null => {
    if (!spec.resolutions.length) {
      return l.resolution === null ? NO_RESOLUTION : null;
    }
    return l.resolution === null ? NO_RESOLUTION : enumSpelling(l.resolution, spec.resolutions);
  };
  const priced = creditsBy(found.lines, BILLING_UNITS[billing], spelled);
  const flat = priced[NO_RESOLUTION];
  const creditsByResolution = flat !== undefined && spec.resolutions.length ? Object.fromEntries(spec.resolutions.map((r) => [r, flat])) : priced;
  const resolutions = Object.keys(creditsByResolution);
  if (!resolutions.length) {
    return null;
  }
  return {
    kieModel: spec.model,
    ...(OPENROUTER_TWINS[spec.model] ? { discountFor: OPENROUTER_TWINS[spec.model] } : {}),
    label: spec.label,
    catalogue,
    fields: spec.fields,
    maxRefs: spec.maxRefs,
    billing,
    creditsByResolution,
    defaultResolution: resolutions[0],
    ...(perSecond ? { durations: spec.durations } : {}),
    ...(spec.numericDuration && spec.fields.duration ? { numeric: true } : {}),
    aspectRatios: spec.aspectRatios
  };
}

type KieToolModel = {
  tool: ImageTool;
  kieModel: string;
  label: string;
  imageField: string;
  priceBy?: { field: string; token: 'resolution' | 'tier'; variants: Readonly<Record<string, string>> };
  takesPrompt?: boolean;
  keepsLayers?: boolean;
  maskField?: string;
};

const KIE_TOOL_MODELS: readonly KieToolModel[] = [
  { tool: ImageTool.RemoveBackground, kieModel: 'recraft/remove-background', label: 'Remove background', imageField: 'image' },
  { tool: ImageTool.Upscale, kieModel: 'topaz/image-upscale', label: 'Upscale image', imageField: 'image_url', priceBy: { field: 'upscale_factor', token: 'resolution', variants: { '2': '2K', '4': '4K' } } },
  { tool: ImageTool.SplitLayers, kieModel: 'seedream/5-flash-layer-decomposition', label: 'Split into layers', imageField: 'image_url', takesPrompt: true, keepsLayers: true },
  { tool: ImageTool.Inpaint, kieModel: 'ideogram/v3-edit', label: 'Inpaint', imageField: 'image_url', maskField: 'mask_url', takesPrompt: true, priceBy: { field: 'rendering_speed', token: 'tier', variants: { TURBO: 'TURBO', BALANCED: 'BALANCED', QUALITY: 'QUALITY' } } }
];

const TOOL_UNITS = BILLING_UNITS[KieBilling.PerRun];

function toolPriceLines(model: KieToolModel, lines: readonly KieLine[]): TaskPriceLine[] {
  if (!model.priceBy) {
    return Object.values(creditsBy(lines, TOOL_UNITS, () => NO_RESOLUTION)).map((credits) => line({}, credits));
  }
  const { field, token, variants } = model.priceBy;
  const credits = creditsBy(lines, TOOL_UNITS, (l) => l[token]);
  return Object.entries(variants).flatMap(([value, variant]) => (credits[variant] === undefined ? [] : [line({ [field]: value }, credits[variant])]));
}

function kieToolRow(model: KieToolModel, pricing: TaskPriceLine[], syncedAt: string): AiModelRow {
  return {
    id: IMAGE_TOOL_MODEL[model.tool],
    catalogue: 'image',
    provider: TaskProviderName.Kie,
    label: model.label,
    input_modalities: ['image'],
    output_modalities: ['image'],
    supported_parameters: [model.imageField],
    supported_resolutions: [],
    param_schema: model.priceBy ? { [model.priceBy.field]: { type: 'enum', values: Object.keys(model.priceBy.variants) } } : {},
    pricing: { lines: pricing },
    synced_at: syncedAt,
    released_at: null,
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored: false,
    wire_spec: {
      model: model.kieModel,
      requiresImage: true,
      ...(model.keepsLayers ? { layers: true } : {}),
      ...(model.maskField ? { requiresMask: true } : {}),
      menuGroup: IMAGE_TOOLS_GROUP,
      maxRefs: 1,
      fields: { ...(model.takesPrompt ? { prompt: 'prompt' } : {}), images: [model.imageField], ...(model.maskField ? { mask: model.maskField } : {}) }
    }
  };
}

function toolRows(prices: KiePrices, syncedAt: string): AiModelRow[] {
  return KIE_TOOL_MODELS.flatMap((model) => {
    const lines = toolPriceLines(model, prices.get(modelKeyOf(model.kieModel))?.lines ?? []);
    return lines.length ? [kieToolRow(model, lines, syncedAt)] : [];
  });
}

export function kieModelRows(prices: KiePrices, specs: readonly KieSpec[], syncedAt: string): AiModelRow[] {
  const curated = new Set(KIE_MODELS.map((model) => model.kieModel));
  const models = [
    ...KIE_MODELS.map((model) => pricedModel(model, prices)),
    ...specs.filter((spec) => !curated.has(spec.model)).map((spec) => discovered(spec, prices))
  ];
  const unique = new Map(models.filter((m): m is PricedKieModel => m !== null).map((m) => [m.kieModel, m]));
  return [...[...unique.values()].map((model) => kieRow(model, syncedAt)), ...toolRows(prices, syncedAt)];
}
