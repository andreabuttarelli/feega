import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { KIE_CREDIT_USD } from '$lib/server/kie';

const TOKENS_PER_MILLION = 1_000_000;
const CENTS_PER_USD = 100;
const USD_PRECISION = 1e9;
const NOTES_MAX_CHARS = 200;
const VARIANT_NOTES_MAX = 8;
const UNPRICED_LABEL = 'not published';
const DURATION_INPUTS = ['duration', 'seconds', 'durationSeconds', 'totalVideoSeconds'];
const METERED_METHOD = 'cp-readoutput';
const PIXEL_METHOD = 'cp-pixel';

export type PriceEntry = {
  model: string;
  provider: string;
  kind: string;
  unit: string;
  usdLow: number | null;
  usdHigh: number | null;
  notes: string;
};

type Base = Pick<PriceEntry, 'model' | 'provider' | 'kind'>;

export type SnapshotRow = {
  id: string;
  catalogue: string;
  provider: string;
  label: string | null;
  pricing: unknown;
};

export type KieRecord = { modelDescription?: string; interfaceType?: string; creditPrice?: string; creditUnit?: string };

type TaskLine = { usd: number; inputs: Record<string, string>; method: string };

type OutputLine = { billable: string; unit: string; cost_usd: number; variant?: string };

const PROVIDER_LABEL: Readonly<Record<string, string>> = {
  openrouter: 'OpenRouter',
  wiro: 'Wiro',
  kie: 'Kie',
  higgsfield: 'Higgsfield',
  elevenlabs: 'ElevenLabs'
};

export const providerLabel = (provider: string): string => PROVIDER_LABEL[provider] ?? provider;

const round = (usd: number): number => Math.round(usd * USD_PRECISION) / USD_PRECISION;

const MDX_ESCAPES: ReadonlyArray<[RegExp, string]> = [
  [/\|/g, '\\|'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/\{/g, '&#123;'],
  [/\}/g, '&#125;'],
  [/\n+/g, ' ']
];

const cell = (text: string): string => MDX_ESCAPES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text).trim();

export function creditsText(usd: number): string {
  const credits = usd * CREDITS_PER_USD_SUBSCRIPTION_LIST;
  if (credits >= 100) {
    return String(Math.round(credits));
  }
  if (credits >= 10) {
    return String(Number(credits.toFixed(1)));
  }
  if (credits >= 0.001) {
    return String(Number(credits.toPrecision(2)));
  }
  return String(Number(credits.toFixed(6)));
}

export function entry(base: Base, unit: string, values: readonly number[], notes: string): PriceEntry {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return { ...base, unit, usdLow: round(low), usdHigh: high === low ? null : round(high), notes };
}

export function unpriced(base: Base, unit: string, notes: string): PriceEntry {
  return { ...base, unit, usdLow: null, usdHigh: null, notes };
}

function trimmed(parts: readonly string[]): string {
  const text = parts.join('; ');
  return text.length > NOTES_MAX_CHARS ? `${text.slice(0, NOTES_MAX_CHARS - 1).trimEnd()}…` : text;
}

function variantNotes(variants: ReadonlyMap<string, number>): string[] {
  return [...variants].slice(0, VARIANT_NOTES_MAX).map(([name, usd]) => `${name}: ${creditsText(usd)}`);
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  return groups;
}

function chatEntries(base: Base, pricing: Record<string, unknown>): PriceEntry[] {
  const sides: Array<[string, unknown]> = [
    ['per 1M input tokens', pricing.prompt],
    ['per 1M output tokens', pricing.completion]
  ];
  return sides.flatMap(([unit, raw]) => {
    const perToken = Number(raw);
    return Number.isFinite(perToken) ? [entry(base, unit, [perToken * TOKENS_PER_MILLION], '')] : [];
  });
}

const OUTPUT_UNITS: Readonly<Record<string, { unit: string; scale: number }>> = {
  image: { unit: 'per image', scale: 1 },
  token: { unit: 'per 1M output tokens', scale: TOKENS_PER_MILLION },
  megapixel: { unit: 'per megapixel', scale: 1 }
};

function isOutputLine(value: unknown): value is OutputLine {
  const line = value as Partial<OutputLine> | null;
  return Boolean(line && line.billable === 'output_image' && typeof line.cost_usd === 'number' && typeof line.unit === 'string' && line.unit in OUTPUT_UNITS);
}

function openRouterImageEntries(base: Base, pricing: Record<string, unknown>): PriceEntry[] {
  const endpoints = Array.isArray(pricing.endpoints) ? (pricing.endpoints as Array<{ lines?: unknown[] }>) : [];
  const lines = endpoints.flatMap((endpoint) => (endpoint.lines ?? []).filter(isOutputLine));
  return [...groupBy(lines, (line) => line.unit)].map(([unit, group]) => {
    const { unit: label, scale } = OUTPUT_UNITS[unit];
    const variants = new Map(group.filter((line) => line.variant).map((line) => [line.variant as string, line.cost_usd * scale]));
    return entry(base, label, group.map((line) => line.cost_usd * scale), trimmed(variantNotes(variants)));
  });
}

type VideoKey = { unit: string; toUsd: (raw: number) => number };

const VIDEO_KEYS: ReadonlyArray<[RegExp, VideoKey]> = [
  [/^cents_per_.*second/, { unit: 'per second', toUsd: (raw) => raw / CENTS_PER_USD }],
  [/^(?:\w+_)?duration_seconds/, { unit: 'per second', toUsd: (raw) => raw }],
  [/^video_tokens/, { unit: 'per 1M video tokens', toUsd: (raw) => raw * TOKENS_PER_MILLION }]
];

function openRouterVideoEntries(base: Base, pricing: Record<string, unknown>): PriceEntry[] {
  const priced = Object.entries(pricing).flatMap(([key, raw]) => {
    const rule = VIDEO_KEYS.find(([pattern]) => pattern.test(key));
    const value = Number(raw);
    return rule && Number.isFinite(value) ? [{ key, unit: rule[1].unit, usd: rule[1].toUsd(value) }] : [];
  });
  return [...groupBy(priced, (p) => p.unit)].map(([unit, group]) => {
    const variants = new Map(group.map((p) => [p.key, p.usd]));
    return entry(base, unit, group.map((p) => p.usd), group.length > 1 ? trimmed(variantNotes(variants)) : '');
  });
}

function durationOf(inputs: Record<string, string>): number | null {
  const key = DURATION_INPUTS.find((name) => name in inputs);
  const seconds = key ? Number.parseFloat(inputs[key]) : Number.NaN;
  return seconds > 0 ? seconds : null;
}

function inputNotes(lines: readonly TaskLine[]): string[] {
  const values = new Map<string, Set<string>>();
  for (const line of lines) {
    for (const [name, value] of Object.entries(line.inputs)) {
      values.set(name, (values.get(name) ?? new Set()).add(value));
    }
  }
  return [...values].map(([name, set]) => `${name}: ${[...set].join(', ')}`);
}

function isTaskLine(value: unknown): value is TaskLine {
  const line = value as Partial<TaskLine> | null;
  return Boolean(line && typeof line.usd === 'number' && typeof line.method === 'string' && line.inputs && typeof line.inputs === 'object');
}

function runUnit(kind: string, line: TaskLine): string {
  return kind === 'image' || line.method === PIXEL_METHOD ? 'per image' : 'per run';
}

function taskEntries(base: Base, pricing: Record<string, unknown>): PriceEntry[] {
  const lines = Array.isArray(pricing.lines) ? pricing.lines.filter(isTaskLine) : [];
  const paid = lines.filter((line) => line.usd > 0 && line.method !== METERED_METHOD);
  if (!paid.length) {
    return [unpriced(base, 'per run', 'metered when the run finishes; no static price')];
  }
  const unitOf = (line: TaskLine) => (durationOf(line.inputs) ? 'per second' : runUnit(base.kind, line));
  return [...groupBy(paid, unitOf)].map(([unit, group]) => {
    const values = group.map((line) => line.usd / (durationOf(line.inputs) ?? 1));
    return entry(base, unit, values, trimmed(inputNotes(group)));
  });
}

type Builder = (base: Base, pricing: Record<string, unknown>, provider: string) => PriceEntry[];

const OPENROUTER = 'openrouter';

const BUILDERS: Readonly<Record<string, Builder>> = {
  chat: (base, pricing) => chatEntries(base, pricing),
  image: (base, pricing, provider) => (provider === OPENROUTER ? openRouterImageEntries(base, pricing) : taskEntries(base, pricing)),
  video: (base, pricing, provider) => (provider === OPENROUTER ? openRouterVideoEntries(base, pricing) : taskEntries(base, pricing)),
  model3d: (base, pricing) => taskEntries(base, pricing)
};

export function entriesFromRows(rows: readonly SnapshotRow[]): PriceEntry[] {
  return rows.flatMap((row) => {
    const build = BUILDERS[row.catalogue];
    const pricing = (row.pricing && typeof row.pricing === 'object' ? row.pricing : {}) as Record<string, unknown>;
    const base = {
      model: row.label && row.label !== row.id ? `${row.label} (${row.id})` : row.id,
      provider: providerLabel(row.provider),
      kind: row.catalogue === 'chat' ? 'text' : row.catalogue
    };
    return build ? build(base, pricing, row.provider) : [];
  });
}

export function entriesFromKie(records: readonly KieRecord[]): PriceEntry[] {
  return records.flatMap((record) => {
    const credits = Number(record.creditPrice);
    if (!Number.isFinite(credits) || !record.creditUnit || !record.modelDescription) {
      return [];
    }
    const base = { model: record.modelDescription, provider: providerLabel('kie'), kind: record.interfaceType === 'chat' ? 'text' : (record.interfaceType ?? 'other') };
    return [entry(base, record.creditUnit, [credits * KIE_CREDIT_USD], '')];
  });
}

function creditsRange(item: PriceEntry): string {
  if (item.usdLow === null) {
    return UNPRICED_LABEL;
  }
  const low = creditsText(item.usdLow);
  return item.usdHigh === null ? low : `${low}–${creditsText(item.usdHigh)}`;
}

const byModel = (a: PriceEntry, b: PriceEntry): number =>
  a.provider.localeCompare(b.provider) || a.kind.localeCompare(b.kind) || a.model.localeCompare(b.model) || a.unit.localeCompare(b.unit);

export function renderPriceTable(entries: readonly PriceEntry[]): string {
  const rows = [...entries].sort(byModel).map((e) => `| ${cell(e.model)} | ${e.provider} | ${e.kind} | ${e.unit} | ${creditsRange(e)} | ${cell(e.notes)} |`);
  return ['| Model | Provider | Kind | Unit | Credits | Notes |', '|---|---|---|---|---|---|', ...rows, ''].join('\n');
}
