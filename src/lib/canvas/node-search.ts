import { colourOf, type ColourTag } from './node-colour';

export type SearchableNode = { id: string; type: string; displayName: string | null; data: Record<string, unknown> };

const SEARCHED_FIELDS = ['title', 'prompt', 'text', 'caption'] as const;

function haystack(node: SearchableNode): string {
  const fields = SEARCHED_FIELDS.map((field) => node.data[field]).filter((value): value is string => typeof value === 'string');
  return [node.displayName ?? '', ...fields].join(' ').toLowerCase();
}

export function searchNodes<T extends SearchableNode>(nodes: readonly T[], query: string, colour: ColourTag | null = null): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0 && !colour) {
    return [];
  }

  return nodes.filter((node) => {
    if (colour && colourOf(node.data) !== colour) {
      return false;
    }
    const text = haystack(node);
    return words.every((word) => text.includes(word));
  });
}
