import { z } from 'zod';
import { FileMove, type FileChanged } from './git-host';

export enum CodeSourceKind {
  Github = 'github',
  Folder = 'folder'
}

export const isPushable = (kind: string): kind is CodeSourceKind => (Object.values(CodeSourceKind) as string[]).includes(kind);

export enum EntryKind {
  Page = 'page',
  Component = 'component'
}

export enum ComponentRole {
  Main = 'main',
  Instance = 'instance'
}

export enum LinkState {
  Conflict = 'conflict',
  Orphan = 'orphan',
  AccessLost = 'access_lost',
  NewerUpstream = 'newer_upstream',
  Modified = 'modified',
  InPull = 'in_pull',
  InSync = 'in_sync'
}

const PATH = z.string().max(500);

export const linkSchema = z.object({
  source: z.enum(CodeSourceKind).default(CodeSourceKind.Github),
  repo: z.string().min(3).max(1000),
  appRoot: PATH.default(''),
  entryKind: z.enum(EntryKind),
  entry: PATH,
  role: z.enum(ComponentRole).optional(),
  route: z.string().max(300).optional(),
  routeParams: z.record(z.string().max(100), z.string().max(300)).default({}),
  baseBranch: z.string().max(200),
  baseSha: z.string().max(64),
  files: z.array(PATH).max(500).default([]),
  pushBranch: z.string().max(200).optional(),
  pushSha: z.string().max(64).optional(),
  pushParent: z.string().max(64).optional(),
  pushTouched: z.array(PATH).max(500).optional(),
  pullNumber: z.number().int().positive().optional(),
  writable: z.boolean().default(true),
  restored: z.array(z.object({ path: PATH, content: z.string() })).max(500).optional(),
  beforePoster: z.string().max(200).optional(),
  variantOf: z.string().max(100).optional()
});

export type CodeLink = z.infer<typeof linkSchema>;

export const linkKey = (link: Pick<CodeLink, 'entryKind' | 'entry' | 'role' | 'route'>) => [link.entryKind, link.role ?? '', link.route ?? '', link.entry].join(':');

export type LinkFacts = { link: CodeLink; upstream: FileChanged[]; modified: string[]; writable: boolean; inPull?: boolean };

const joined = (root: string, path: string) => (root ? `${root.replace(/\/$/, '')}/${path}` : path);

export const entryPath = (link: CodeLink) => joined(link.appRoot, link.entry);

const graphOf = (link: CodeLink) => new Set([entryPath(link), ...link.files.map((f) => joined(link.appRoot, f))]);

const inApp = (link: CodeLink, path: string) => (link.appRoot ? path.slice(link.appRoot.length + 1) : path);

export function followRenames(link: CodeLink, upstream: FileChanged[]): CodeLink {
  const renamed = new Map(upstream.filter((c) => c.move === FileMove.Renamed && c.from).map((c) => [c.from!, c.path]));
  const moved = (path: string) => {
    const to = renamed.get(joined(link.appRoot, path));
    return to ? inApp(link, to) : path;
  };
  return { ...link, entry: moved(link.entry), files: link.files.map(moved) };
}

type Rule = { state: LinkState; holds: (f: LinkFacts, touched: FileChanged[]) => boolean };

const STATUS_RULES: Rule[] = [
  { state: LinkState.Conflict, holds: (f, touched) => touched.some((c) => f.modified.includes(c.path)) },
  { state: LinkState.Orphan, holds: (_f, touched) => touched.some((c) => c.move === FileMove.Removed) },
  { state: LinkState.AccessLost, holds: (f) => !f.writable },
  { state: LinkState.NewerUpstream, holds: (_f, touched) => touched.length > 0 },
  { state: LinkState.Modified, holds: (f) => f.modified.length > 0 },
  { state: LinkState.InPull, holds: (f) => Boolean(f.inPull) }
];

export function linkStatus(facts: LinkFacts): LinkState {
  const graph = graphOf(facts.link);
  const touched = facts.upstream.filter((c) => graph.has(c.path) || (c.from !== null && graph.has(c.from)));
  return STATUS_RULES.find((r) => r.holds(facts, touched))?.state ?? LinkState.InSync;
}
