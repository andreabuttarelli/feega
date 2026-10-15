export type ModelProvider = { provider: string; providerLabel: string };

export const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  'bytedance-seed': 'ByteDance',
  bytedance: 'ByteDance',
  qwen: 'Qwen',
  'x-ai': 'xAI',
  kwaivgi: 'Kling',
  'black-forest-labs': 'Black Forest Labs',
  meta: 'Meta',
  mistralai: 'Mistral',
  perplexity: 'Perplexity',
  deepseek: 'DeepSeek',
  cohere: 'Cohere',
  wiro: 'Wiro',
  kie: 'Kie.ai',
  openrouter: 'OpenRouter',
  higgsfield: 'Higgsfield'
};

function labelFor(key: string): string {
  return PROVIDER_NAMES[key] ?? key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function providerOf(wireId: string): ModelProvider {
  const bare = wireId.startsWith('~') ? wireId.slice(1) : wireId;
  const slash = bare.indexOf('/');
  const key = slash === -1 ? 'other' : bare.slice(0, slash).toLowerCase();
  return { provider: key, providerLabel: labelFor(key) };
}

export function providerName(id: string): string {
  return labelFor(id);
}
