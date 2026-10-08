import { request } from './api.ts';

export type GalleryCard = {
  id: string;
  title: string;
  author: string;
  kind: 'motion' | 'composition';
  format: string;
  seconds: number;
  tags: string[];
  remixes: number;
  remix_of: string | null;
  url: string;
};

export type GallerySearch = { query?: string; kind?: string; format?: string; duration?: string; tag?: string };
export type GalleryRemix = { node_id: string; project_id: string; canvas_id: string; editor_url: string; title: string };
export type GalleryPublish = { node_id: string; title: string; description?: string; tags?: string[] };

const withOrg = (path: string, org?: string) => (org ? `${path}${path.includes('?') ? '&' : '?'}${new URLSearchParams({ org })}` : path);
const id = encodeURIComponent;

function searchPath(search: GallerySearch): string {
  const params = new URLSearchParams(
    Object.entries({ q: search.query, kind: search.kind, format: search.format, duration: search.duration, tag: search.tag }).filter((e): e is [string, string] => Boolean(e[1]))
  );
  const query = params.toString();
  return query ? `/api/v1/gallery?${query}` : '/api/v1/gallery';
}

export const galleryApi = {
  search: (token: string, search: GallerySearch) => request<{ items: GalleryCard[] }>(searchPath(search), token),
  item: (token: string, itemId: string) => request<GalleryCard & { description: string }>(`/api/v1/gallery/${id(itemId)}`, token),
  remix: (token: string, itemId: string, target: { project_id: string; canvas_id?: string }, org?: string) =>
    request<GalleryRemix>(withOrg(`/api/v1/gallery/${id(itemId)}/remix`, org), token, { method: 'POST', body: JSON.stringify(target) }),
  publish: (token: string, body: GalleryPublish, org?: string) =>
    request<{ id: string; url: string }>(withOrg('/api/v1/gallery/publish', org), token, { method: 'POST', body: JSON.stringify(body) }),
  withdraw: (token: string, itemId: string, org?: string) =>
    request<{ id: string; status: string }>(withOrg(`/api/v1/gallery/${id(itemId)}`, org), token, { method: 'DELETE' })
};
