export const DOCS_ORIGIN = 'https://docs.feega.app';
export const GUIDES_INDEX_URL = `${DOCS_ORIGIN}/guides.json`;

export type Guide = { path: string; title: string; section: string };

function isGuide(value: unknown): value is Guide {
  const guide = value as Guide | null;
  return (
    typeof guide?.path === 'string' && typeof guide.title === 'string' && typeof guide.section === 'string'
  );
}

export function parseGuides(json: unknown): Guide[] {
  return Array.isArray(json) ? json.filter(isGuide) : [];
}

export function filterGuides(guides: Guide[], query: string): Guide[] {
  const needle = query.trim().toLowerCase();
  return guides.filter((guide) => guide.title.toLowerCase().includes(needle));
}

export function guideUrl(path: string): string {
  return `${DOCS_ORIGIN}/${path}/`;
}
