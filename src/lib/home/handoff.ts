import { kindOf, type PromptKind } from '$lib/home/prompt-kinds';
import { sourceOf, type PromptSource } from '$lib/home/prompt-sources';

const HANDOFF_PROMPT = 'prompt';
const HANDOFF_SOURCE = 'source';
export const HANDOFF_NONCE = 'go';
export const HANDOFF_RESUMED = 'resumed';

export const HANDOFF_PARAMS = [HANDOFF_PROMPT, 'kind', HANDOFF_SOURCE, 'attach', HANDOFF_NONCE, HANDOFF_RESUMED];

export enum HandoffStart {
  Send = 'send',
  Prefill = 'prefill',
  None = 'none'
}

export type Handoff = { text: string; kind: PromptKind; source: PromptSource | null; waitsForImages: boolean };

export function handoffOf(params: URLSearchParams): Handoff | null {
  const text = params.get(HANDOFF_PROMPT)?.trim() ?? '';
  const kind = kindOf(params.get('kind'));
  const source = sourceOf(params.get(HANDOFF_SOURCE));
  if ((!text && !source) || !kind) {
    return null;
  }

  return { text, kind, source, waitsForImages: params.get('attach') === '1' };
}

export function resumedQuery(search: string, mint: () => string): string {
  const params = new URLSearchParams(search);
  if (!params.get(HANDOFF_NONCE)) {
    params.set(HANDOFF_NONCE, mint());
  }
  params.set(HANDOFF_RESUMED, '1');
  return `?${params}`;
}
