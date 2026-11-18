import { posix } from 'node:path';
import { entryPath, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { VariantChoice } from '$lib/canvas/source-changes';

export { VariantChoice };

export type VariantAsk = { nodeId: string; choice: VariantChoice; route?: string };

export type Suggested = { nodeId: string; route: string };

type File = { path: string; content: string };

const HOME = '/';
const SUFFIX = '-variant';

export const suggestedRoute = (route: string | undefined) => (!route || route === HOME ? `/home${SUFFIX}` : `${route.replace(/\/$/, '')}${SUFFIX}`);

export function routeFileOf(link: CodeLink, route: string): string {
  const own = (link.route ?? HOME).replace(/^\/|\/$/g, '');
  const dir = posix.dirname(link.entry);
  const root = own ? dir.slice(0, dir.length - own.length).replace(/\/$/, '') : dir;
  return posix.join(root, route.replace(/^\/|\/$/g, ''), posix.basename(link.entry));
}

export function relocated(link: CodeLink, route: string, files: File[]): File[] {
  const from = entryPath(link);
  const to = entryPath({ ...link, entry: routeFileOf(link, route) });
  return files.filter((f) => f.path === from).map((f) => ({ path: to, content: f.content }));
}

export async function makeVariant(deps: { links: LinkStore }, ids: { from: string; to: string }): Promise<CodeLink[]> {
  const links = (await deps.links.all(ids.from)).map((l) => ({ ...l, variantOf: ids.from, pushBranch: undefined, pushSha: undefined, pushParent: undefined, pushTouched: undefined, pullNumber: undefined }));
  for (const link of links) {
    await deps.links.save(ids.to, link);
  }
  return links;
}

export type VariantDeps = { links: LinkStore; duplicate: (nodeId: string) => Promise<string | null> };

export type Varied = { ok: true; nodeId: string; links: number } | { ok: false; refusal: 'not_linked' };

export async function frameVariant(deps: VariantDeps, nodeId: string): Promise<Varied> {
  if (!(await deps.links.all(nodeId)).length) {
    return { ok: false, refusal: 'not_linked' };
  }
  const to = await deps.duplicate(nodeId);
  if (!to) {
    return { ok: false, refusal: 'not_linked' };
  }
  return { ok: true, nodeId: to, links: (await makeVariant(deps, { from: nodeId, to })).length };
}
