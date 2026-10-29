export const CHAT_AGENT_KEY = 'sidebar';

export enum HistorySource {
  Event = 'event',
  Version = 'version',
  Revision = 'revision',
  Branch = 'branch'
}

export enum EntryKind {
  NodeCreate = 'node.create',
  NodeUpdate = 'node.update',
  NodeDelete = 'node.delete',
  EdgeCreate = 'edge.create',
  EdgeDelete = 'edge.delete',
  VersionSave = 'version.save',
  RevisionCommit = 'revision.commit',
  BranchCreate = 'branch.create'
}

export const ENTRY_VERBS: Record<EntryKind, string> = {
  [EntryKind.NodeCreate]: 'Added',
  [EntryKind.NodeUpdate]: 'Changed',
  [EntryKind.NodeDelete]: 'Removed',
  [EntryKind.EdgeCreate]: 'Connected',
  [EntryKind.EdgeDelete]: 'Disconnected',
  [EntryKind.VersionSave]: 'Saved version',
  [EntryKind.RevisionCommit]: 'Edited frame',
  [EntryKind.BranchCreate]: 'Branched'
};

export enum LaneKind {
  Person = 'person',
  Chat = 'chat',
  Agent = 'agent',
  System = 'system'
}

export enum HistoryFilter {
  All = 'all',
  Ai = 'ai',
  People = 'people'
}

export enum LaneIcon {
  Person = 'person',
  Chat = 'chat',
  Agent = 'agent',
  System = 'system'
}

export type AuthorKind = 'user' | 'agent' | 'system';

export type HistoryAuthor = { kind: AuthorKind; id: string | null; agentKey: string | null };

export type HistoryEntry = {
  id: string;
  source: HistorySource;
  kind: EntryKind;
  at: string;
  author: HistoryAuthor;
  nodeId: string | null;
  frameId: string | null;
  summary: string | null;
};

export type Lane = { key: string; kind: LaneKind; label: string; colour: string; icon: LaneIcon };

export type HistoryRow = { entry: HistoryEntry; lane: number };

export type HistoryGraph = { lanes: Lane[]; rows: HistoryRow[] };

export type Names = Record<string, string>;

export type HistoryQuery = { filter: HistoryFilter; frameId?: string | null; names: Names; limit?: number };

const LANE_COLOURS = ['#2f6fed', '#d9480f', '#2b8a3e', '#ae3ec9', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4'];

const SOMEONE = 'Someone';

type LaneRule = { icon: LaneIcon; key: (a: HistoryAuthor) => string; label: (a: HistoryAuthor, names: Names) => string };

const LANE_RULES: Record<LaneKind, LaneRule> = {
  [LaneKind.Person]: { icon: LaneIcon.Person, key: (a) => `person:${a.id}`, label: (a, names) => (a.id && names[a.id]) || SOMEONE },
  [LaneKind.Chat]: { icon: LaneIcon.Chat, key: () => 'chat', label: () => 'Chat' },
  [LaneKind.Agent]: { icon: LaneIcon.Agent, key: (a) => `agent:${a.agentKey}`, label: (a) => a.agentKey ?? 'Agent' },
  [LaneKind.System]: { icon: LaneIcon.System, key: () => 'system', label: () => 'System' }
};

const AGENT_KEY_LANES: Record<string, LaneKind> = { [CHAT_AGENT_KEY]: LaneKind.Chat };

const LANE_OF_AUTHOR: Record<AuthorKind, (a: HistoryAuthor) => LaneKind> = {
  user: () => LaneKind.Person,
  agent: (a) => AGENT_KEY_LANES[a.agentKey ?? ''] ?? LaneKind.Agent,
  system: () => LaneKind.System
};

const FILTER_LANES: Record<HistoryFilter, ReadonlySet<LaneKind>> = {
  [HistoryFilter.All]: new Set(Object.values(LaneKind)),
  [HistoryFilter.Ai]: new Set([LaneKind.Chat, LaneKind.Agent]),
  [HistoryFilter.People]: new Set([LaneKind.Person])
};

export const isHistoryFilter = (value: string): value is HistoryFilter => (Object.values(HistoryFilter) as string[]).includes(value);

function colourOf(key: string): string {
  const hash = [...key].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 0);
  return LANE_COLOURS[hash % LANE_COLOURS.length];
}

export function laneOf(author: HistoryAuthor, names: Names): Lane {
  const kind = LANE_OF_AUTHOR[author.kind](author);
  const rule = LANE_RULES[kind];
  const key = rule.key(author);
  return { key, kind, label: rule.label(author, names), colour: colourOf(key), icon: rule.icon };
}

const touches = (entry: HistoryEntry, frameId: string) => entry.nodeId === frameId || entry.frameId === frameId;

export function historyGraph(entries: HistoryEntry[], query: HistoryQuery): HistoryGraph {
  const admitted = FILTER_LANES[query.filter];
  const lanes: Lane[] = [];
  const rows: HistoryRow[] = [];

  const ordered = [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  for (const entry of ordered) {
    if (rows.length === (query.limit ?? Number.POSITIVE_INFINITY)) {
      break;
    }

    const lane = laneOf(entry.author, query.names);
    if (!admitted.has(lane.kind)) {
      continue;
    }
    if (query.frameId && !touches(entry, query.frameId)) {
      continue;
    }

    const known = lanes.findIndex((l) => l.key === lane.key);
    rows.push({ entry, lane: known === -1 ? lanes.push(lane) - 1 : known });
  }

  return { lanes, rows };
}

export enum HistoryAction {
  Preview = 'preview',
  Restore = 'restore',
  Name = 'name',
  Merge = 'merge',
  Drop = 'drop'
}

const SOURCE_ACTIONS: Record<HistorySource, readonly HistoryAction[]> = {
  [HistorySource.Event]: [],
  [HistorySource.Version]: [HistoryAction.Preview, HistoryAction.Restore],
  [HistorySource.Revision]: [HistoryAction.Preview, HistoryAction.Restore, HistoryAction.Name],
  [HistorySource.Branch]: [HistoryAction.Merge, HistoryAction.Drop]
};

export const actionsOf = (entry: Pick<HistoryEntry, 'source'>): readonly HistoryAction[] => SOURCE_ACTIONS[entry.source];

export type EntryRef = { source: HistorySource; key: string; version: number | null };

export function entryRef(id: string): EntryRef | null {
  const [source, key, version] = id.split(':');
  if (!key || !(Object.values(HistorySource) as string[]).includes(source)) {
    return null;
  }
  const number = version === undefined ? null : Number(version);
  if (number !== null && !Number.isInteger(number)) {
    return null;
  }
  return { source: source as HistorySource, key, version: number };
}

export type LaneSpan = { first: number; last: number };

export function laneSpans(graph: HistoryGraph): LaneSpan[] {
  const spans = graph.lanes.map(() => ({ first: Number.POSITIVE_INFINITY, last: -1 }));
  graph.rows.forEach((row, index) => {
    const span = spans[row.lane];
    span.first = Math.min(span.first, index);
    span.last = Math.max(span.last, index);
  });
  return spans;
}

export type BranchFork = { from: number; to: number; lane: number };

export function branchForks(graph: HistoryGraph): BranchFork[] {
  return graph.rows.flatMap((row, from) => {
    if (row.entry.source !== HistorySource.Branch) {
      return [];
    }
    const to = graph.rows.findIndex((r, i) => i > from && r.entry.source === HistorySource.Revision && r.entry.nodeId === row.entry.frameId);
    return to === -1 ? [] : [{ from, to, lane: graph.rows[to].lane }];
  });
}
