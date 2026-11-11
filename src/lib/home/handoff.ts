import { kindOf, type PromptKind } from '$lib/home/prompt-kinds';

export const HANDOFF_PROMPT = 'prompt';

export type Handoff = { text: string; kind: PromptKind; source: string | null; waitsForImages: boolean };

export function handoffOf(params: URLSearchParams): Handoff | null {
  const text = params.get(HANDOFF_PROMPT)?.trim();
  const kind = kindOf(params.get('kind'));
  if (!text || !kind) {
    return null;
  }

  return { text, kind, source: params.get('source'), waitsForImages: params.get('attach') === '1' };
}
