import { commonPropertiesOf, dynamicParamsOf, type GenPropertyType } from './common-properties';
import { effectiveModel } from './default-models';
import { nodeControlsOf } from './node-controls';
import { PROVIDER_PARAM } from './model-routes';
import type { ModelChoice } from './gen-node';

type Summary = Parameters<typeof commonPropertiesOf>[0][number];

export function genPropertiesOf(summaries: Summary[], choicesFor?: (type: GenPropertyType) => ModelChoice[]) {
  const properties = commonPropertiesOf(summaries);
  const choices = properties.type && choicesFor ? choicesFor(properties.type) : [];
  const modelValue = properties.model.kind === 'same' && properties.type ? effectiveModel(properties.type, properties.model.value, choices) : null;
  const choice = modelValue ? choices.find((c) => c.id === modelValue) : null;
  const dynamicValues = dynamicParamsOf(summaries, (choice?.params ?? []).map((p) => p.name));
  const provider = dynamicParamsOf(summaries, [PROVIDER_PARAM])[PROVIDER_PARAM];
  const providerValue = provider.kind === 'same' && typeof provider.value === 'string' ? provider.value : null;

  return { properties, choices, modelValue, providerValue, controls: nodeControlsOf(properties, choice, dynamicValues) };
}
