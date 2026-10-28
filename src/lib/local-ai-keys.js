export const LOCAL_AI_PROVIDERS = [
  { name: 'kie', label: 'Kie.ai', required: ['KIE_API_KEY'], optional: ['KIE_BASE_URL'] },
  { name: 'openrouter', label: 'OpenRouter', required: ['OPENROUTER_API_KEY'], optional: [] },
  { name: 'llm', label: 'Text LLM', required: ['LLM_API_KEY'], optional: ['LLM_BASE_URL', 'LLM_DEFAULT_MODEL'] },
  { name: 'higgsfield', label: 'Higgsfield', required: ['HIGGSFIELD_API_KEY_ID', 'HIGGSFIELD_API_KEY_SECRET'], optional: ['HIGGSFIELD_BASE_URL'] },
  { name: 'wiro', label: 'Wiro', required: ['WIRO_API_KEY'], optional: ['WIRO_API_SECRET', 'WIRO_BASE_URL'] },
  { name: 'elevenlabs', label: 'ElevenLabs', required: ['ELEVENLABS_API_KEY'], optional: ['ELEVENLABS_BASE_URL'] }
];

export const AI_KEY_VARS = LOCAL_AI_PROVIDERS.flatMap((provider) => [...provider.required, ...provider.optional]);

const keyed = (env, provider) => provider.required.every((name) => Boolean(env[name]?.trim()));

export const keyedProviders = (env) => LOCAL_AI_PROVIDERS.filter((provider) => keyed(env, provider));

export const hasAiKey = (env) => keyedProviders(env).length > 0;
