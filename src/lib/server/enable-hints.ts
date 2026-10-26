type OptionalFeature = { missing: RegExp; keys: readonly string[]; enables: string };

const OPTIONAL_FEATURES: readonly OptionalFeature[] = [
  { missing: /LLM_API_KEY|llm_unconfigured/i, keys: ['LLM_API_KEY'], enables: 'the AI agent and text generation' },
  { missing: /WIRO_API_KEY|WIRO_API_SECRET/i, keys: ['WIRO_API_KEY', 'WIRO_API_SECRET'], enables: 'Wiro image and video models' },
  { missing: /KIE_API_KEY/i, keys: ['KIE_API_KEY'], enables: 'Kie.ai image and video models' },
  { missing: /HIGGSFIELD_API_KEY/i, keys: ['HIGGSFIELD_API_KEY_ID', 'HIGGSFIELD_API_KEY_SECRET'], enables: 'Higgsfield models' },
  { missing: /STRIPE_SECRET_KEY/i, keys: ['STRIPE_SECRET_KEY'], enables: 'paid plans and checkout' },
  { missing: /RESEND_API_KEY/i, keys: ['RESEND_API_KEY'], enables: 'email' },
  { missing: /EXA_API_KEY/i, keys: ['EXA_API_KEY'], enables: 'agent web search' },
  { missing: /BROWSERLESS_API_KEY/i, keys: ['BROWSERLESS_API_KEY'], enables: 'the agent browser' }
];

export function enableHint(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const feature = OPTIONAL_FEATURES.find((candidate) => candidate.missing.test(message));
  if (!feature) {
    return null;
  }
  return `Add ${feature.keys.join(' and ')} to .env to enable ${feature.enables}.`;
}
