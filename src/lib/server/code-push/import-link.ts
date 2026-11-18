import type { CodeOriginData } from '$lib/canvas/motion-node';
import type { GitHost } from './git-host';
import { ComponentRole, EntryKind, isPushable, linkSchema, type CodeLink, CodeSourceKind } from './link';
import { importGraph, type ReadSource } from './import-graph';
import type { LinkStore } from './link-store';

export type RouteFile = { path: string; file: string; params: string[] };

export type LibraryFile = { name: string; file: string };

export type Imported = { source: CodeSourceKind; repo: string; appRoot: string; baseBranch: string; baseSha: string; landed: string[]; routes: RouteFile[]; components?: LibraryFile[]; poster?: string | null };

type Matched = { route: RouteFile; params: Record<string, string> };

const PARAM = /^\[(?:\.\.\.)?([^\]]+)\]$/;

const segments = (path: string) => path.split('/').filter(Boolean);

function matched(route: RouteFile, landed: string): Matched | null {
  const want = segments(route.path);
  const got = segments(landed);
  if (want.length !== got.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [i, segment] of want.entries()) {
    const param = segment.match(PARAM);
    if (param) {
      params[param[1]] = got[i];
      continue;
    }
    if (segment !== got[i]) {
      return null;
    }
  }
  return { route, params };
}

const exactFirst = (a: RouteFile, b: RouteFile) => a.params.length - b.params.length;

const LOCALE_PREFIX = /^\/[a-z]{2}(?:-[A-Za-z]{2,4})?(?=\/|$)/;

const delocalized = (landed: string) => landed.replace(LOCALE_PREFIX, '') || '/';

const firstMatch = (routes: RouteFile[], landed: string) =>
  [...routes]
    .sort(exactFirst)
    .map((r) => matched(r, landed))
    .find((m) => m !== null) ?? null;

const matchOf = (routes: RouteFile[], landed: string) => firstMatch(routes, landed) ?? firstMatch(routes, delocalized(landed));

type Base = Omit<CodeLink, 'entryKind' | 'entry' | 'role' | 'route' | 'routeParams' | 'files'>;

const baseLinkOf = (imported: Imported): Base =>
  linkSchema.omit({ entryKind: true, entry: true, role: true, route: true, routeParams: true, files: true }).parse({ source: imported.source, repo: imported.repo, appRoot: imported.appRoot, baseBranch: imported.baseBranch, baseSha: imported.baseSha, beforePoster: imported.poster ?? undefined });

const inRoot = (root: string, path: string) => (root ? `${root.replace(/\/$/, '')}/${path}` : path);

type Page = Matched & { graph: string[] };

export async function importLinks(imported: Imported, read: ReadSource): Promise<CodeLink[]> {
  const found = imported.landed.map((path) => matchOf(imported.routes, path)).filter((m): m is Matched => m !== null);
  const unique = [...new Map(found.map((m) => [m.route.file, m])).values()];
  const pages: Page[] = await Promise.all(unique.map(async (m) => ({ ...m, graph: await importGraph(m.route.file, (p) => read(inRoot(imported.appRoot, p))) })));
  const base = baseLinkOf(imported);

  const pageLinks = pages.map((p) => linkSchema.parse({ ...base, entryKind: EntryKind.Page, entry: p.route.file, route: p.route.path, routeParams: p.params, files: p.graph.length ? p.graph : [p.route.file] }));
  const used = (imported.components ?? []).filter((c) => pages.some((p) => p.graph.includes(c.file)));
  const mains = used.map((c) => linkSchema.parse({ ...base, entryKind: EntryKind.Component, role: ComponentRole.Main, entry: c.file, files: [c.file] }));
  const instances = used.flatMap((c) => pages.filter((p) => p.graph.includes(c.file)).map((p) => linkSchema.parse({ ...base, entryKind: EntryKind.Component, role: ComponentRole.Instance, entry: c.file, route: p.route.path, routeParams: p.params, files: [p.route.file, c.file] })));
  return [...pageLinks, ...mains, ...instances];
}

export type LinkDeps = { host: (source: CodeSourceKind, repo: string) => Promise<GitHost | null>; links: LinkStore };

export type RoutesListed = { app: string; routes: RouteFile[] };

const GIT_NATIVE: Record<CodeSourceKind, boolean> = { [CodeSourceKind.Github]: true, [CodeSourceKind.Folder]: false };

async function baseOf(host: GitHost, source: CodeSourceKind, origin: CodeOriginData) {
  const baseBranch = origin.branch ?? (await host.defaultBranch());
  const baseSha = GIT_NATIVE[source] && origin.sha ? origin.sha : await host.headOf(baseBranch);
  return { baseBranch, baseSha };
}

export type ImportExtras = { components: LibraryFile[]; poster: string | null };

const NO_EXTRAS: ImportExtras = { components: [], poster: null };

export async function linkImported(deps: LinkDeps, nodeId: string, origin: CodeOriginData, listed: RoutesListed, extras: ImportExtras = NO_EXTRAS): Promise<CodeLink[]> {
  if (!isPushable(origin.kind)) {
    return [];
  }
  const host = await deps.host(origin.kind, origin.repo);
  if (!host) {
    return [];
  }

  const base = await baseOf(host, origin.kind, origin);
  const links = await importLinks({ source: origin.kind, repo: origin.repo, appRoot: listed.app, landed: origin.routes, routes: listed.routes, ...base, ...extras }, (path) => host.readFile(path, base.baseSha));
  for (const link of links) {
    await deps.links.save(nodeId, link);
  }
  return links;
}
