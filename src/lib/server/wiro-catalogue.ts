import type { AiModelCatalogue, AiModelRow } from './ai-models-sync';
import type { WireFields } from './canvas/task-provider';
import type { TaskPricing } from './generation/task-pricing';
import { idPrefixOf, TaskProviderName } from './generation/task-providers';

export const WIRO_PROVIDER = TaskProviderName.Wiro;
export const WIRO_ID_PREFIX = idPrefixOf(TaskProviderName.Wiro);

const LIST_LIMIT = '500';
const CATALOGUE_QUERIES: ReadonlyArray<Record<string, unknown>> = [
  { categories: ['text-to-image'] },
  { categories: ['text-to-video'] },
  { categories: ['3d-generation'] },
  { search: 'uncensored' }
];

const CATALOGUE_OF_CATEGORY: Readonly<Record<string, AiModelCatalogue>> = {
  'text-to-video': 'video',
  'image-to-video': 'video',
  'video-to-video': 'video',
  '3d-generation': 'model3d'
};
const PROMPTLESS_CATALOGUES: ReadonlySet<AiModelCatalogue> = new Set(['model3d']);
const FILE_INPUT_TYPES = new Set(['combinefileinput', 'fileinput', 'multifileinput']);
const PROMPT_FIELD = 'prompt';
const UNCENSORED = /uncensored/i;
const LAST_FRAME = /last|end/i;
const NON_IMAGE_FILE = /video|audio/i;

const CONTROL_ALIASES: Readonly<Record<'aspectRatio' | 'resolution' | 'duration', { wire: readonly string[]; schemaKey: string }>> = {
  aspectRatio: { wire: ['ratio', 'aspectRatio', 'aspect_ratio'], schemaKey: 'aspect_ratio' },
  resolution: { wire: ['resolution'], schemaKey: 'resolution' },
  duration: { wire: ['duration'], schemaKey: 'duration' }
};

type WiroParam = {
  id?: string;
  type?: string;
  required?: boolean;
  value?: unknown;
  options?: Array<{ value?: unknown }> | null;
};

export type WiroTool = {
  title?: string;
  cleanslugowner?: string;
  cleanslugproject?: string;
  categories?: string[];
  parameters?: Array<{ items?: WiroParam[] }> | null;
  dynamicprice?: string | null;
  time?: string | number | null;
};

export type WiroWireSpec = {
  owner: string;
  project: string;
  fields: WireFields;
  fixed?: Record<string, string>;
  requiresImage?: true;
  unrunnable?: string;
};

export const WIRO_UNRUNNABLE = {
  requiredWithoutDefault: 'required_field_without_default',
  uncensoredNeedsImage: 'uncensored_requires_image'
} as const;

function defaultOf(param: WiroParam): string {
  const declared = param.value === undefined || param.value === null ? '' : String(param.value);
  return declared || (optionValues(param)[0] ?? '');
}

const fillable = (param: WiroParam): boolean => Boolean(param.required) && !isFile(param) && param.id !== PROMPT_FIELD;

function fixedOf(params: WiroParam[]): Record<string, string> {
  return Object.fromEntries(params.filter((p) => fillable(p) && defaultOf(p)).map((p) => [p.id!, defaultOf(p)]));
}

function requiresImage(params: WiroParam[]): boolean {
  return params.some((p) => p.required && isFile(p) && !NON_IMAGE_FILE.test(p.id!));
}

function unrunnableOf(params: WiroParam[], uncensored: boolean): string | undefined {
  if (params.some((p) => fillable(p) && !defaultOf(p))) {
    return WIRO_UNRUNNABLE.requiredWithoutDefault;
  }
  return uncensored && requiresImage(params) ? WIRO_UNRUNNABLE.uncensoredNeedsImage : undefined;
}

function paramsOf(tool: WiroTool): WiroParam[] {
  return (tool.parameters ?? []).flatMap((group) => group.items ?? []).filter((p) => typeof p.id === 'string');
}

function optionValues(param: WiroParam): string[] {
  return (param.options ?? []).map((o) => String(o.value ?? '')).filter(Boolean);
}

function catalogueOf(tool: WiroTool): AiModelCatalogue {
  const matched = (tool.categories ?? []).map((c) => CATALOGUE_OF_CATEGORY[c]).find(Boolean);
  return matched ?? 'image';
}

function pricingOf(raw: string | null | undefined): TaskPricing {
  try {
    const lines = JSON.parse(raw ?? '[]') as Array<{ inputs?: Record<string, unknown>; price?: unknown; priceMethod?: unknown }>;
    return {
      lines: lines.map((line) => ({
        inputs: Object.fromEntries(Object.entries(line.inputs ?? {}).map(([k, v]) => [k, String(v)])),
        usd: Number(line.price) || 0,
        method: String(line.priceMethod ?? '')
      }))
    };
  } catch {
    return { lines: [] };
  }
}

function releasedAt(time: WiroTool['time']): string | null {
  const seconds = Number(time);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function isFile(param: WiroParam): boolean {
  return FILE_INPUT_TYPES.has(param.type ?? '');
}

function wiringOf(params: WiroParam[], catalogue: AiModelCatalogue): { fields: WireFields; controls: Set<string> } | null {
  const hasPrompt = params.some((p) => p.id === PROMPT_FIELD);
  if (!hasPrompt && !PROMPTLESS_CATALOGUES.has(catalogue)) {
    return null;
  }
  if (params.some((p) => isFile(p) && p.required && NON_IMAGE_FILE.test(p.id!))) {
    return null;
  }

  const fields: WireFields = hasPrompt ? { prompt: PROMPT_FIELD, images: [] } : { images: [] };
  const controls = new Set<string>(hasPrompt ? [PROMPT_FIELD] : []);
  for (const [control, alias] of Object.entries(CONTROL_ALIASES) as Array<[keyof typeof CONTROL_ALIASES, (typeof CONTROL_ALIASES)[keyof typeof CONTROL_ALIASES]]>) {
    const match = params.find((p) => alias.wire.includes(p.id!) && optionValues(p).length);
    if (match) {
      fields[control] = match.id!;
      controls.add(match.id!);
    }
  }

  for (const param of params.filter((p) => isFile(p) && !NON_IMAGE_FILE.test(p.id!))) {
    controls.add(param.id!);
    if (LAST_FRAME.test(param.id!)) {
      fields.lastFrame = param.id!;
      continue;
    }
    fields.images.push(param.id!);
  }
  return { fields, controls };
}

function paramSchemaOf(params: WiroParam[], fields: WireFields, controls: Set<string>): Record<string, unknown> {
  const schema: Record<string, unknown> = {};
  for (const [control, alias] of Object.entries(CONTROL_ALIASES)) {
    const wireId = fields[control as keyof typeof CONTROL_ALIASES];
    const param = params.find((p) => p.id === wireId);
    if (param) {
      schema[alias.schemaKey] = { type: 'enum', values: optionValues(param) };
    }
  }
  for (const param of params) {
    if (controls.has(param.id!) || isFile(param)) {
      continue;
    }
    const values = optionValues(param);
    if (param.type === 'select' && values.length) {
      schema[param.id!] = { type: 'enum', values };
    }
  }
  return schema;
}

export function wiroModelRow(tool: WiroTool, syncedAt: string): (AiModelRow & { wire_spec: WiroWireSpec }) | null {
  if (!tool.cleanslugowner || !tool.cleanslugproject) {
    return null;
  }
  const params = paramsOf(tool);
  const catalogue = catalogueOf(tool);
  const wiring = wiringOf(params, catalogue);
  if (!wiring) {
    return null;
  }

  const resolutionParam = params.find((p) => p.id === wiring.fields.resolution);
  const label = tool.title?.trim() || `${tool.cleanslugowner}/${tool.cleanslugproject}`;
  const uncensored = UNCENSORED.test(`${label} ${tool.cleanslugproject}`);
  const fixed = fixedOf(params);
  const unrunnable = unrunnableOf(params, uncensored);
  return {
    id: `${WIRO_ID_PREFIX}${tool.cleanslugowner}/${tool.cleanslugproject}`,
    catalogue,
    provider: WIRO_PROVIDER,
    label,
    input_modalities: [...(wiring.fields.prompt ? ['text'] : []), ...(wiring.fields.images.length ? ['image'] : [])],
    output_modalities: [catalogue],
    supported_parameters: params.map((p) => p.id!),
    supported_resolutions: resolutionParam ? optionValues(resolutionParam) : [],
    param_schema: paramSchemaOf(params, wiring.fields, wiring.controls),
    pricing: pricingOf(tool.dynamicprice),
    synced_at: syncedAt,
    released_at: releasedAt(tool.time),
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    uncensored,
    wire_spec: {
      owner: tool.cleanslugowner,
      project: tool.cleanslugproject,
      fields: wiring.fields,
      ...(Object.keys(fixed).length ? { fixed } : {}),
      ...(requiresImage(params) ? { requiresImage: true as const } : {}),
      ...(unrunnable ? { unrunnable } : {})
    }
  };
}

export async function fetchWiroCatalogue(
  doFetch: typeof fetch,
  baseUrl: string,
  syncedAt: string
): Promise<{ rows: AiModelRow[]; ok: boolean; reason?: string }> {
  try {
    const replies = await Promise.all(
      CATALOGUE_QUERIES.map(async (query) => {
        const res = await doFetch(`${baseUrl.replace(/\/$/, '')}/Tool/List`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ start: '0', limit: LIST_LIMIT, ...query })
        });
        if (!res.ok) {
          throw new Error(`Wiro /Tool/List responded ${res.status}`);
        }
        return ((await res.json()) as { tool?: WiroTool[] }).tool ?? [];
      })
    );
    const byId = new Map<string, AiModelRow>();
    for (const tool of replies.flat()) {
      const row = wiroModelRow(tool, syncedAt);
      if (row) {
        byId.set(row.id, row);
      }
    }
    return { rows: [...byId.values()], ok: true };
  } catch (error) {
    return { rows: [], ok: false, reason: error instanceof Error ? error.message : 'wiro catalogue fetch_failed' };
  }
}
