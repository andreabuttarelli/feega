import { beforeEach, describe, expect, it } from 'vitest';
import { fakeGithub, type FakeGithub } from './fake-github.testkit';
import { githubHost } from './github-host';
import { EntryKind, linkSchema, type CodeLink } from './link';
import { frameCompare, frameRetarget, versionOf, type CompareDeps, type VersionMark } from './frames-compare';
import { FramesRefusal } from './frames-push';

const REPO = { owner: 'acme', repo: 'app', ref: null };

let gh: FakeGithub;
let links: Map<string, CodeLink>;
let imported: { ref: string; at: { x: number; y: number }; entry: string }[];
let marks: Map<string, VersionMark>;
let removed: string[];
let mainSha: string;
let branchSha: string;

const deps = (): CompareDeps => ({
  host: async () => githubHost(gh.call, REPO),
  links: { read: async (id) => links.get(id) ?? null },
  placeOf: async (id) => (id === 'n1' || marks.has(id) ? { canvasId: 'c1', x: id === 'n1' ? 100 : 580, y: 50, w: 400, h: 300 } : null),
  markOf: async (id) => marks.get(id) ?? null,
  remove: async (id) => {
    removed.push(id);
    marks.delete(id);
  },
  importAt: async (ask) => {
    imported.push({ ref: ask.sha, at: ask.centre, entry: ask.link.entry });
    return { frameId: `v${imported.length}` };
  },
  mark: async (frameId, mark) => {
    marks.set(frameId, mark);
  }
});

beforeEach(() => {
  gh = fakeGithub();
  imported = [];
  marks = new Map();
  removed = [];
  mainSha = gh.seed('main', { 'src/Hero.tsx': 'v0' });
  branchSha = gh.seed('feega/x', { 'src/Hero.tsx': 'v1' });
  gh.tag('v1', 'main');
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', baseBranch: 'main', baseSha: mainSha })]]);
});

describe('il nome di una versione', () => {
  it.each([
    ['main', 'main'],
    ['feega/x', 'feega/x'],
    ['abc1234def5678', 'abc1234'],
    ['#12', 'PR #12'],
    ['pull/12', 'PR #12']
  ])('%s si legge %s', (ref, label) => {
    expect(versionOf(ref).label).toBe(label);
  });
});

describe('confrontare le versioni di un frame', () => {
  it('ogni ref diventa un frame versione centrato accanto all’originale, allo sha del ref, senza link', async () => {
    const out = await frameCompare(deps(), { nodeId: 'n1', refs: ['main', 'feega/x', 'v1'] });

    expect(out).toMatchObject({ ok: true });
    expect(imported.map((i) => i.ref)).toEqual([mainSha, branchSha, mainSha]);
    expect(imported.map((i) => i.at)).toEqual([
      { x: 100 + 1 * (400 + 80) + 200, y: 50 + 150 },
      { x: 100 + 2 * (400 + 80) + 200, y: 50 + 150 },
      { x: 100 + 3 * (400 + 80) + 200, y: 50 + 150 }
    ]);
    expect(marks.get('v2')).toEqual({ of: 'n1', ref: 'feega/x', label: 'feega/x', sha: branchSha, entry: 'src/Hero.tsx' });
    expect(links.size).toBe(1);
  });

  it('una PR si apre allo sha della sua testa', async () => {
    await githubHost(gh.call, REPO).upsertPull({ branch: 'feega/x', base: 'main', title: 'X', body: '' });

    await frameCompare(deps(), { nodeId: 'n1', refs: ['#1'] });

    expect(imported[0].ref).toBe(branchSha);
    expect(marks.get('v1')?.label).toBe('PR #1');
  });

  it('un frame senza link è not_linked', async () => {
    expect(await frameCompare(deps(), { nodeId: 'none', refs: ['main'] })).toEqual({ ok: false, refusal: FramesRefusal.NotLinked });
  });

  it('un ref che non esiste non importa nulla', async () => {
    const out = await frameCompare(deps(), { nodeId: 'n1', refs: ['gone'] });

    expect(out).toMatchObject({ ok: false });
    expect(imported).toEqual([]);
  });
});

describe('scorrere la storia di una versione', () => {
  it('il frame versione passa a un altro commit nello stesso posto', async () => {
    await frameCompare(deps(), { nodeId: 'n1', refs: ['main'] });

    const out = await frameRetarget(deps(), { versionId: 'v1', ref: branchSha });

    expect(out).toMatchObject({ ok: true, versions: [{ frameId: 'v2', label: branchSha.slice(0, 7), of: 'n1' }] });
    expect(imported[1]).toMatchObject({ ref: branchSha, at: { x: 580 + 200, y: 50 + 150 } });
    expect(removed).toEqual(['v1']);
  });

  it('un frame che non è una versione è not_linked', async () => {
    expect(await frameRetarget(deps(), { versionId: 'n1', ref: 'main' })).toEqual({ ok: false, refusal: FramesRefusal.NotLinked });
  });
});
