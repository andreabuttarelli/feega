import type { ModelChoice, PricedInputs } from '$lib/canvas/gen-node';
import { providerOf } from '$lib/canvas/model-provider';
import { modelParamsOf } from '$lib/canvas/model-params';
import { billedCreditsFor } from '$lib/credit-ladder';
import type { WireFields } from './canvas/task-provider';
import type { TaskWireSpec } from './canvas/task-run';
import { isTaskPricing, PER_RUN_METHODS } from './generation/task-pricing';

const DEFAULT_ASPECTS = ['1:1'];

export type TaskRow = {
  id: string;
  label: string | null;
  input_modalities: string[] | null;
  supported_resolutions: string[] | null;
  param_schema: Record<string, unknown> | null;
  pricing?: unknown;
  uncensored?: boolean | null;
  wire_spec?: unknown;
};

const NODE_PARAM_OF_FIELD: Readonly<Record<'aspectRatio' | 'resolution' | 'duration', string>> = {
  aspectRatio: 'aspectRatio',
  resolution: 'resolution',
  duration: 'duration'
};

function enumValues(schema: Record<string, unknown> | null, key: string): string[] {
  const values = (schema?.[key] as { values?: unknown } | undefined)?.values;
  return Array.isArray(values) ? values.map(String) : [];
}

export function wireSpecOf(raw: unknown): TaskWireSpec | null {
  const spec = raw as Partial<TaskWireSpec> | null;
  return spec?.fields && Array.isArray(spec.fields.images) ? (spec as TaskWireSpec) : null;
}

function maxRefsOf(spec: TaskWireSpec | null): number {
  const fields = spec?.fields;
  if (!fields) {
    return 0;
  }
  return fields.imageList ? Number(spec.maxRefs ?? 1) : fields.images.length;
}

function nodeKeyOf(fields: WireFields): (wireKey: string) => string {
  const byWire = new Map(
    (Object.keys(NODE_PARAM_OF_FIELD) as Array<keyof typeof NODE_PARAM_OF_FIELD>)
      .filter((field) => fields[field])
      .map((field) => [fields[field]!, NODE_PARAM_OF_FIELD[field]])
  );
  return (wireKey) => byWire.get(wireKey) ?? wireKey;
}

function pricedInputsOf(row: TaskRow, fields: WireFields): PricedInputs[] | undefined {
  if (!isTaskPricing(row.pricing)) {
    return undefined;
  }
  const lines = row.pricing.lines.filter((line) => PER_RUN_METHODS.has(line.method) && line.usd > 0);
  if (!lines.length) {
    return undefined;
  }
  const nodeKey = nodeKeyOf(fields);
  return lines.map((line) => ({
    inputs: Object.fromEntries(Object.entries(line.inputs).map(([k, v]) => [nodeKey(k), v])),
    credits: billedCreditsFor(line.usd)
  }));
}

const textOnly = (modalities: string[] | null): string[] => (modalities ?? []).filter((modality) => modality !== 'image');

export function taskChoice(row: TaskRow): ModelChoice {
  const spec = wireSpecOf(row.wire_spec);
  const fields = spec?.fields ?? { prompt: 'prompt', images: [] };
  const schema = row.param_schema ?? {};
  const durations = enumValues(schema, 'duration').map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const aspects = enumValues(schema, 'aspect_ratio');
  const pricedInputs = pricedInputsOf(row, fields);
  const uncensored = row.uncensored === true;

  return {
    id: row.id,
    label: row.label ?? row.id,
    ...(spec?.menuGroup ? { menuGroup: spec.menuGroup } : {}),
    aspectRatios: aspects.length ? aspects : DEFAULT_ASPECTS,
    maxRefs: uncensored ? 0 : maxRefsOf(spec),
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities: uncensored ? textOnly(row.input_modalities) : row.input_modalities ?? [],
    resolutions: row.supported_resolutions?.length ? row.supported_resolutions : undefined,
    ...(durations.length
      ? { durationOptions: durations, minDuration: Math.min(...durations), maxDuration: Math.max(...durations) }
      : {}),
    uncensored,
    pricedInputs,
    variableCredits: !pricedInputs,
    params: modelParamsOf(schema)
  };
}
