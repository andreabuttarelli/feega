const CACHED_BY_BREAKPOINT = /^anthropic\//;
const BREAKPOINT = { type: 'ephemeral' };

export enum PromptCache {
  Off = 'off',
  On = 'on'
}

export function withPromptCache(body: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return body;
  }

  if (typeof parsed.model !== 'string' || !CACHED_BY_BREAKPOINT.test(parsed.model) || parsed.cache_control) {
    return body;
  }
  return JSON.stringify({ ...parsed, cache_control: BREAKPOINT });
}
