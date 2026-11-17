import type { CodeOriginData } from '$lib/canvas/motion-node';
import type { GitHost } from './git-host';
import { EntryKind, isPushable, linkSchema, type CodeLink, CodeSourceKind } from './link';
import type { LinkStore } from './link-store';

export type RouteFile = { path: string; file: string; params: string[] };

export type Imported = { source: CodeSourceKind; repo: string; appRoot: string; baseBranch: string; baseSha: string; landed: string[]; routes: RouteFile[] };

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

const matchOf = (routes: RouteFile[], landed: string) =>
  [...routes]
    .sort(exactFirst)
    .map((r) => matched(r, landed))
    .find((m) => m !== null) ?? null;

export function importLink(imported: Imported): CodeLink | null {
  const found = imported.landed.map((path) => matchOf(imported.routes, path)).filter((m): m is Matched => m !== null);
  if (!found.length) {
    return null;
  }

  const [entry] = found;
  return linkSchema.parse({
    source: imported.source,
    repo: imported.repo,
    appRoot: imported.appRoot,
    entryKind: EntryKind.Page,
    entry: entry.route.file,
    route: entry.route.path,
    routeParams: entry.params,
    baseBranch: imported.baseBranch,
    baseSha: imported.baseSha,
    files: [...new Set(found.map((m) => m.route.file))]
  });
}

export type LinkDeps = { host: (source: CodeSourceKind, repo: string) => Promise<GitHost | null>; links: LinkStore };

export type RoutesListed = { app: string; routes: RouteFile[] };

const GIT_NATIVE: Record<CodeSourceKind, boolean> = { [CodeSourceKind.Github]: true, [CodeSourceKind.Folder]: false };

async function baseOf(host: GitHost, source: CodeSourceKind, origin: CodeOriginData) {
  const baseBranch = origin.branch ?? (await host.defaultBranch());
  const baseSha = GIT_NATIVE[source] && origin.sha ? origin.sha : await host.headOf(baseBranch);
  return { baseBranch, baseSha };
}

export async function linkImported(deps: LinkDeps, nodeId: string, origin: CodeOriginData, listed: RoutesListed): Promise<CodeLink | null> {
  if (!isPushable(origin.kind)) {
    return null;
  }
  const host = await deps.host(origin.kind, origin.repo);
  if (!host) {
    return null;
  }

  const link = importLink({ source: origin.kind, repo: origin.repo, appRoot: listed.app, landed: origin.routes, routes: listed.routes, ...(await baseOf(host, origin.kind, origin)) });
  if (link) {
    await deps.links.save(nodeId, link);
  }
  return link;
}
