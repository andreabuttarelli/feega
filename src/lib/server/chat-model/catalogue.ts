import { CostTier, DEFAULT_CHAT_CHOICE, defaultEffortOf, type ChatModelChoice, type ChatModelOption } from '$lib/chat-model';
import { ensureGatewayModels, gatewayModels, type GatewayModel } from '$lib/server/openrouter-models';

export enum ChoiceError {
  UnknownModel = 'unknown_model',
  UnsupportedReasoning = 'unsupported_reasoning'
}

export type ChoiceOutcome = { ok: true; choice: ChatModelChoice } | { ok: false; error: ChoiceError };

export type AskedChoice = { model?: unknown; reasoning?: unknown };

const COST_TIERS: ReadonlyArray<{ belowUsdPerM: number; tier: CostTier }> = [
  { belowUsdPerM: 2, tier: CostTier.Low },
  { belowUsdPerM: 8, tier: CostTier.Mid },
  { belowUsdPerM: Infinity, tier: CostTier.High }
];

const isAlias = (id: string) => id.includes(':') || id.startsWith('~');

const providerOf = (id: string) => id.split('/')[0] ?? id;

function costTierOf(rate: GatewayModel['rate']): CostTier {
  const usdPerM = rate.input + rate.output;
  return COST_TIERS.find((row) => usdPerM < row.belowUsdPerM)!.tier;
}

export function chatModelOptions(models: readonly GatewayModel[]): ChatModelOption[] {
  return models
    .filter((m) => m.tools && !isAlias(m.id))
    .map((m) => ({
      id: m.id,
      label: m.label,
      provider: providerOf(m.id),
      costTier: costTierOf(m.rate),
      inputUsdPerM: m.rate.input,
      outputUsdPerM: m.rate.output,
      efforts: m.reasoning ? m.efforts : [],
      defaultEffort: m.reasoning ? m.defaultEffort : null
    }));
}

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function choiceFor(option: ChatModelOption, reasoning: unknown): ChoiceOutcome {
  const asked = asText(reasoning);
  if (!asked) {
    return { ok: true, choice: { model: option.id, reasoning: defaultEffortOf(option) } };
  }
  if (!option.efforts.includes(asked)) {
    return { ok: false, error: ChoiceError.UnsupportedReasoning };
  }
  return { ok: true, choice: { model: option.id, reasoning: asked } };
}

export function resolveChoice(options: readonly ChatModelOption[], asked: AskedChoice): ChoiceOutcome {
  const wanted = asText(asked.model) || (asked.model === undefined ? DEFAULT_CHAT_CHOICE.model : '');
  const option = options.find((o) => o.id === wanted);
  if (option) {
    return choiceFor(option, asked.reasoning);
  }
  if (asked.model === undefined && !options.length) {
    return { ok: true, choice: { model: DEFAULT_CHAT_CHOICE.model, reasoning: null } };
  }
  return { ok: false, error: ChoiceError.UnknownModel };
}

export enum ToolForcing {
  Allowed = 'allowed',
  Refused = 'refused'
}

const MOTION_MODELS: Record<string, { forcing: ToolForcing }> = {
  'anthropic/claude-opus-5.5': { forcing: ToolForcing.Refused },
  'anthropic/claude-opus-5': { forcing: ToolForcing.Allowed },
  'anthropic/claude-sonnet-5.5': { forcing: ToolForcing.Refused },
  'openai/gpt-5.6-sol': { forcing: ToolForcing.Allowed }
};

export const MOTION_CAPABLE_MODELS: ReadonlySet<string> = new Set(Object.keys(MOTION_MODELS));

export function toolForcing(model: string): ToolForcing {
  return MOTION_MODELS[model]?.forcing ?? ToolForcing.Refused;
}

export type MotionAsk = { asked: AskedChoice; refused: string | null };

export function motionAsk(asked: AskedChoice): MotionAsk {
  const model = asText(asked.model);
  if (!model || MOTION_CAPABLE_MODELS.has(model)) {
    return { asked, refused: null };
  }
  return { asked: {}, refused: model };
}

export function reasoningProviderOptions(reasoning: string | null): Record<string, Record<string, string | boolean>> {
  if (!reasoning) {
    return {};
  }
  return { openai: { reasoningEffort: reasoning, forceReasoning: true } };
}

export async function offeredChatModels(): Promise<ChatModelOption[]> {
  await ensureGatewayModels();
  return chatModelOptions(gatewayModels());
}
