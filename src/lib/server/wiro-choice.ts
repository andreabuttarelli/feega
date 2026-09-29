import type { ModelChoice, PricedInputs } from '$lib/canvas/gen-node';
import { providerOf } from '$lib/canvas/model-provider';
import { modelParamsOf } from '$lib/canvas/model-params';
import { billedCreditsFor } from '$lib/credit-ladder';
import { isWiroPricing, type WiroFields, type WiroWireSpec } from './wiro-catalogue';

const PRICED_PER_RUN = new Set(['cpr', 'cpo']);
const DEFAULT_ASPECTS = ['1:1'];

export type WiroRow = {
  id: string;
  label: string | null;
  input_modalities: string[] | null;
  supported_resolutions: string[] | null;
  param_schema: Record<string, unknown> | null;
  pricing: unknown;
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

export function wireSpecOf(raw: unknown): WiroWireSpec | null {
  const spec = raw as Partial<WiroWireSpec> | null;
  return spec?.owner && spec.project && spec.fields ? (spec as WiroWireSpec) : null;
}

function nodeKeyOf(fields: WiroFields): (wireKey: string) => string {
  const byWire = new Map(
    (Object.keys(NODE_PARAM_OF_FIELD) as Array<keyof typeof NODE_PARAM_OF_FIELD>)
      .filter((field) => fields[field])
      .map((field) => [fields[field]!, NODE_PARAM_OF_FIELD[field]])
  );
  return (wireKey) => byWire.get(wireKey) ?? wireKey;
}

function pricedInputsOf(row: WiroRow, fields: WiroFields): PricedInputs[] | undefined {
  if (!isWiroPricing(row.pricing)) {
    return undefined;
  }
  const lines = row.pricing.lines.filter((line) => PRICED_PER_RUN.has(line.method) && line.usd > 0);
  if (!lines.length) {
    return undefined;
  }
  const nodeKey = nodeKeyOf(fields);
  return lines.map((line) => ({
    inputs: Object.fromEntries(Object.entries(line.inputs).map(([k, v]) => [nodeKey(k), v])),
    credits: billedCreditsFor(line.usd)
  }));
}

export function wiroChoice(row: WiroRow): ModelChoice {
  const fields = wireSpecOf(row.wire_spec)?.fields ?? { prompt: 'prompt', images: [] };
  const schema = row.param_schema ?? {};
  const durations = enumValues(schema, 'duration').map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const aspects = enumValues(schema, 'aspect_ratio');
  const pricedInputs = pricedInputsOf(row, fields);

  return {
    id: row.id,
    label: row.label ?? row.id,
    aspectRatios: aspects.length ? aspects : DEFAULT_ASPECTS,
    maxRefs: fields.images.length,
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities: row.input_modalities ?? [],
    resolutions: row.supported_resolutions?.length ? row.supported_resolutions : undefined,
    ...(durations.length
      ? { durationOptions: durations, minDuration: Math.min(...durations), maxDuration: Math.max(...durations) }
      : {}),
    uncensored: row.uncensored === true,
    pricedInputs,
    variableCredits: !pricedInputs,
    params: modelParamsOf(schema)
  };
}
