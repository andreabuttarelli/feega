export const NODES_PARAM = 'nodes';

export function selectionLink(page: URL, ids: readonly string[]): string {
  const link = new URL(page);
  link.searchParams.set(NODES_PARAM, ids.join(','));
  return link.toString();
}

export function idsFromLink(params: URLSearchParams): string[] {
  return (params.get(NODES_PARAM) ?? '').split(',').filter(Boolean);
}
