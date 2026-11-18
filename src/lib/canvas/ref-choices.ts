export type CommitStep = { sha: string; message: string; author: string; at: string };

export enum RefGroup {
  Branches = 'Branches',
  Tags = 'Tags',
  Pulls = 'Pull requests',
  Commits = 'Recent commits'
}

export type RefChoice = { ref: string; label: string; detail: string };

export type Versions = {
  refs: { name: string; kind: string; sha: string }[];
  pulls: { number: number; title: string; branch: string; sha: string }[];
  commits: CommitStep[];
};

const SHORT_SHA = 7;
const BRANCH = 'branch';
const TAG = 'tag';

const named = (v: Versions, kind: string): RefChoice[] => v.refs.filter((r) => r.kind === kind).map((r) => ({ ref: r.name, label: r.name, detail: r.sha.slice(0, SHORT_SHA) }));

const GROUPS: [RefGroup, (v: Versions) => RefChoice[]][] = [
  [RefGroup.Branches, (v) => named(v, BRANCH)],
  [RefGroup.Tags, (v) => named(v, TAG)],
  [RefGroup.Pulls, (v) => v.pulls.map((p) => ({ ref: `#${p.number}`, label: `PR #${p.number}`, detail: p.title }))],
  [RefGroup.Commits, (v) => v.commits.map((c) => ({ ref: c.sha, label: c.sha.slice(0, SHORT_SHA), detail: `${c.message} · ${c.author}` }))]
];

export function refChoices(v: Versions): { group: RefGroup; choices: RefChoice[] }[] {
  return GROUPS.map(([group, of]) => ({ group, choices: of(v) })).filter((g) => g.choices.length > 0);
}
