export const LINKED_EDGE = 'is-linked';

type Edge = { source: string; target: string; class?: string };

export function focusEdges<E extends Edge>(edges: E[], selectedIds: string[]): E[] | null {
  const selected = new Set(selectedIds);
  const linked = (e: E) => selected.has(e.source) || selected.has(e.target);
  const classFor = (e: E) => (linked(e) ? LINKED_EDGE : undefined);

  if (edges.every((e) => e.class === classFor(e))) {
    return null;
  }

  return edges.map((e) => ({ ...e, class: classFor(e) }));
}
