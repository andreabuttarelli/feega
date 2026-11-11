import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { providerOf } from '$lib/canvas/model-provider';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { taskChoice, type TaskRow } from './task-choice';
import { isTaskPricing } from './generation/task-pricing';
import { configuredIn, TaskProviderName } from './generation/task-providers';
import type { WiroWireSpec } from './wiro-catalogue';

const PER_CHARACTER = 'cp-promptlength';
const WIRO_COLUMNS = 'id, label, input_modalities, supported_resolutions, param_schema, pricing, uncensored, wire_spec';

export type WiroCatalogue = 'chat' | 'audio';

type TokenRates = { usdPerMillionIn: number; usdPerMillionOut: number };

function tokenRatesOf(pricing: unknown): TokenRates | null {
  const rates = pricing as Partial<TokenRates> | null;
  return typeof rates?.usdPerMillionIn === 'number' && typeof rates.usdPerMillionOut === 'number' ? (rates as TokenRates) : null;
}

function unrunnable(row: TaskRow): boolean {
  return Boolean((row.wire_spec as Partial<WiroWireSpec> | null)?.unrunnable);
}

export function wiroTextChoice(row: TaskRow): ModelChoice | null {
  const rates = tokenRatesOf(row.pricing);
  if (!rates || unrunnable(row)) {
    return null;
  }
  return {
    id: row.id,
    label: row.label ?? row.id,
    aspectRatios: [],
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities: ['text'],
    textPricing: {
      inputCreditsPerMillion: rates.usdPerMillionIn * CREDITS_PER_USD_SUBSCRIPTION_LIST,
      outputCreditsPerMillion: rates.usdPerMillionOut * CREDITS_PER_USD_SUBSCRIPTION_LIST,
      systemPromptTokens: 0
    }
  };
}

function perCharacterUsd(pricing: unknown): number | null {
  const line = isTaskPricing(pricing) ? pricing.lines.find((l) => l.method === PER_CHARACTER && l.usd > 0) : undefined;
  return line ? line.usd : null;
}

export function wiroAudioChoice(row: TaskRow): ModelChoice | null {
  if (unrunnable(row)) {
    return null;
  }
  const choice = taskChoice(row);
  const perCharacter = perCharacterUsd(row.pricing);
  if (perCharacter !== null) {
    return { ...choice, aspectRatios: [], variableCredits: true, creditsPerCharacter: perCharacter * CREDITS_PER_USD_SUBSCRIPTION_LIST };
  }
  return choice.pricedInputs ? { ...choice, aspectRatios: [] } : null;
}

const CHOICE_OF: Readonly<Record<WiroCatalogue, (row: TaskRow) => ModelChoice | null>> = { chat: wiroTextChoice, audio: wiroAudioChoice };

export async function wiroChoices(
  admin: SupabaseClient,
  catalogue: WiroCatalogue,
  source: Readonly<Record<string, string | undefined>>
): Promise<ModelChoice[]> {
  if (!configuredIn(source).has(TaskProviderName.Wiro)) {
    return [];
  }
  const { data } = await admin.from('ai_models').select(WIRO_COLUMNS).eq('provider', TaskProviderName.Wiro).eq('catalogue', catalogue);
  return ((data ?? []) as TaskRow[]).map(CHOICE_OF[catalogue]).filter((choice): choice is ModelChoice => choice !== null);
}

export async function wiroSpecOf(admin: SupabaseClient, id: string, catalogue: WiroCatalogue): Promise<WiroWireSpec | null> {
  const { data } = await admin.from('ai_models').select('wire_spec').eq('id', id).eq('catalogue', catalogue).maybeSingle();
  const spec = (data as { wire_spec?: Partial<WiroWireSpec> } | null)?.wire_spec;
  return spec?.owner && spec.project && spec.fields && !spec.unrunnable ? (spec as WiroWireSpec) : null;
}
