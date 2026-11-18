import type { AgentModel, AgentModels } from '$lib/acp/agent-models';

const MODEL_CATEGORY = 'model';
const SELECT = 'select';

type SelectOption = { value: string; name: string; description?: string | null };
type ConfigOption = { id: string; category?: string; type: string; currentValue: string; options: SelectOption[] };
type UnstableModel = { modelId: string; name: string; description?: string | null };

export type NewSession = { sessionId: string; configOptions?: ConfigOption[]; models?: { availableModels: UnstableModel[]; currentModelId: string } };

export type ModelSwitch = { method: string; params: Record<string, string> };

type SessionModels = AgentModels & { switchTo: (sessionId: string, model: string) => ModelSwitch };

const modelOption = (session: NewSession) => session.configOptions?.find((o) => o.category === MODEL_CATEGORY && o.type === SELECT);

const fromOption = (o: SelectOption): AgentModel => ({ id: o.value, name: o.name, description: o.description ?? null });

const fromUnstable = (m: UnstableModel): AgentModel => ({ id: m.modelId, name: m.name, description: m.description ?? null });

export function modelsOf(session: NewSession): SessionModels | null {
  const option = modelOption(session);
  if (option) {
    return { current: option.currentValue, models: option.options.map(fromOption), switchTo: (sessionId, value) => ({ method: 'session/set_config_option', params: { sessionId, configId: option.id, value } }) };
  }

  if (session.models) {
    return { current: session.models.currentModelId, models: session.models.availableModels.map(fromUnstable), switchTo: (sessionId, modelId) => ({ method: 'session/set_model', params: { sessionId, modelId } }) };
  }

  return null;
}

export function switchFor(session: NewSession, model: string | null): ModelSwitch | null {
  const offered = modelsOf(session);
  if (!offered || !model || model === offered.current) {
    return null;
  }

  if (!offered.models.some((m) => m.id === model)) {
    return null;
  }

  return offered.switchTo(session.sessionId, model);
}
