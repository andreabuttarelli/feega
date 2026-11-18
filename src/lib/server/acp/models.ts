import type { AgentModel, AgentModels } from '$lib/acp/agent-models';

const MODEL_CATEGORY = 'model';
const EFFORT_CATEGORY = 'thought_level';
const SELECT = 'select';
const VARIANT = /^(.+)\[([^\]]+)\]$/;

type SelectOption = { value: string; name: string; description?: string | null };
type ConfigOption = { id: string; category?: string; type: string; currentValue: string; options: SelectOption[] };
type UnstableModel = { modelId: string; name: string; description?: string | null };

export type NewSession = { sessionId: string; configOptions?: ConfigOption[]; models?: { availableModels: UnstableModel[]; currentModelId: string } };

export type ModelSwitch = { method: string; params: Record<string, string> };

export type Choice = { model: string | null; effort: string | null };

type Effort = {
  current: string | null;
  of: (model: string) => string[];
  apply: (sessionId: string, model: string, effort: string, modelSwitch: ModelSwitch | null) => ModelSwitch[];
};

type SessionModels = Required<AgentModels> & { switchTo: (sessionId: string, model: string) => ModelSwitch; efforts: Effort };

const selectOf = (session: NewSession, category: string) => session.configOptions?.find((o) => o.category === category && o.type === SELECT);

const fromOption = (o: SelectOption): AgentModel => ({ id: o.value, name: o.name, description: o.description ?? null });

const fromUnstable = (m: UnstableModel): AgentModel => ({ id: m.modelId, name: m.name, description: m.description ?? null, efforts: [] });

function variantsOf(session: NewSession): Map<string, string[]> {
  const efforts = new Map<string, string[]>();
  for (const { modelId } of session.models?.availableModels ?? []) {
    const [, base, effort] = modelId.match(VARIANT) ?? [];
    if (base) {
      efforts.set(base, [...(efforts.get(base) ?? []), effort]);
    }
  }

  return efforts;
}

function effortOf(session: NewSession): Effort {
  const option = selectOf(session, EFFORT_CATEGORY);
  if (option) {
    const all = option.options.map((o) => o.value);
    return {
      current: option.currentValue,
      of: () => all,
      apply: (sessionId, _model, value, modelSwitch) => [...(modelSwitch ? [modelSwitch] : []), { method: 'session/set_config_option', params: { sessionId, configId: option.id, value } }]
    };
  }

  const variants = variantsOf(session);
  return {
    current: session.models?.currentModelId.match(VARIANT)?.[2] ?? null,
    of: (model) => variants.get(model) ?? [],
    apply: (sessionId, model, value) => [{ method: 'session/set_model', params: { sessionId, modelId: `${model}[${value}]` } }]
  };
}

function offerOf(session: NewSession): SessionModels | null {
  const option = selectOf(session, MODEL_CATEGORY);
  const efforts = effortOf(session);
  if (option) {
    const models = option.options.map((o) => ({ ...fromOption(o), efforts: efforts.of(o.value) }));
    return { current: option.currentValue, effort: efforts.current, models, efforts, switchTo: (sessionId, value) => ({ method: 'session/set_config_option', params: { sessionId, configId: option.id, value } }) };
  }

  if (session.models) {
    return { current: session.models.currentModelId, effort: null, models: session.models.availableModels.map(fromUnstable), efforts, switchTo: (sessionId, modelId) => ({ method: 'session/set_model', params: { sessionId, modelId } }) };
  }

  return null;
}

export function modelsOf(session: NewSession): Required<AgentModels> | null {
  const offered = offerOf(session);
  return offered && { current: offered.current, effort: offered.effort, models: offered.models };
}

export function switchesFor(session: NewSession, have: Choice, want: Choice): { switches: ModelSwitch[]; now: Choice } {
  const offered = offerOf(session);
  const model = offered?.models.find((m) => m.id === want.model)?.id ?? have.model;
  if (!offered || !model) {
    return { switches: [], now: have };
  }

  const efforts = offered.models.find((m) => m.id === model)?.efforts ?? [];
  const effort = want.effort && efforts.includes(want.effort) ? want.effort : null;
  const modelSwitch = model === have.model ? null : offered.switchTo(session.sessionId, model);
  const kept = model === have.model ? have.effort : null;

  if (effort === null || (effort === have.effort && !modelSwitch)) {
    return { switches: modelSwitch ? [modelSwitch] : [], now: { model, effort: kept } };
  }

  return { switches: offered.efforts.apply(session.sessionId, model, effort, modelSwitch), now: { model, effort } };
}
