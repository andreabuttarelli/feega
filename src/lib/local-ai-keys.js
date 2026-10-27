export const AI_KEY_VARS = ['KIE_API_KEY', 'LLM_API_KEY', 'OPENROUTER_API_KEY'];

export const hasAiKey = (env) => AI_KEY_VARS.some((name) => Boolean(env[name]));
