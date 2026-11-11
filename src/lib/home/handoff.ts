import { kindOf, type PromptKind } from '$lib/home/prompt-kinds';
import { sourceOf, type PromptSource } from '$lib/home/prompt-sources';

const HANDOFF_PROMPT = 'prompt';
const HANDOFF_SOURCE = 'source';

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
