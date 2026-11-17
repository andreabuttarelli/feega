import { beforeEach, describe, expect, it } from 'vitest';
import { fakeGithub, type FakeGithub } from './fake-github.testkit';
import { githubHost } from './github-host';
import { EntryKind, LinkState, linkSchema, type CodeLink } from './link';
import { memoryLock } from './push-lock';
import { SyncOutcome } from '$lib/server/code-import/code-sync';
import type { CodeScope } from '$lib/server/code-import/canvas-import';
import { FramesRefusal, framesPush, frameStatus } from './frames-push';
import { frameCodeDiff, frameRestore, frameVariant, type ActionDeps } from './frames-version-actions';
import type { VersionMark } from '$lib/canvas/version-frame';

const REPO = { owner: 'acme', repo: 'app', ref: null };

let gh: FakeGithub;
let links: Map<string, CodeLink>;
let marks: Map<string, VersionMark>;
let copies: string[];
let oldSha: string;

const scope = {} as CodeScope;

const deps = (): ActionDeps => ({
  host: async () => githubHost(gh.call, REPO),
  links: { read: async (id) => links.get(id) ?? null, save: async (id, l) => Boolean(links.set(id, l)) },
  markOf: async (id) => marks.get(id) ?? null,
  copyAsVariant: async (id) => {
    copies.push(id);
    return `copy-of-${id}`;
  }
});

beforeEach(() => {
  gh = fakeGithub();
  copies = [];
  oldSha = gh.seed('main', { 'src/Hero.tsx': 'old hero\n', 'src/Button.tsx': 'old button\n', 'README.md': 'x' });
  const head = gh.seed('main', { 'src/Hero.tsx': 'new hero\n', 'src/Button.tsx': 'old button\n', 'README.md': 'y' });
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', files: ['src/Hero.tsx', 'src/Button.tsx'], baseBranch: 'main', baseSha: head })]]);
  marks = new Map([['v1', { of: 'n1', ref: 'abc', label: 'abc', sha: oldSha, entry: 'src/Hero.tsx' }]]);
});

describe('ripristinare una versione', () => {
  it('i file del frame a quello sha diventano modifiche del frame collegato, solo quelli cambiati', async () => {
    const out = await frameRestore(deps(), 'v1');

    expect(out).toEqual({ ok: true, nodeId: 'n1', paths: ['src/Hero.tsx'] });
    expect(links.get('n1')?.restored).toEqual([{ path: 'src/Hero.tsx', content: 'old hero\n' }]);
  });

  it('un frame che non è una versione è not_linked', async () => {
    expect(await frameRestore(deps(), 'n1')).toEqual({ ok: false, refusal: FramesRefusal.NotLinked });
  });
});

describe('una variante da una versione', () => {
  it('copia la versione in un frame libero', async () => {
    expect(await frameVariant(deps(), 'v1')).toEqual({ ok: true, frameId: 'copy-of-v1' });
    expect(copies).toEqual(['v1']);
  });
});

describe('il diff del codice tra una versione e il ramo del frame', () => {
  it('ogni file cambiato col prima e il dopo', async () => {
    expect(await frameCodeDiff(deps(), 'v1')).toEqual({ ok: true, from: oldSha, to: 'main', files: [{ path: 'src/Hero.tsx', before: 'old hero\n', after: 'new hero\n' }] });
  });
});

describe('un ripristino passa da Changes e dalla PR', () => {
  const pushDeps = () => ({ ...deps(), links: { ...deps().links, remove: async () => true }, edits: async () => SyncOutcome.NoChanges as const, lock: memoryLock() });

  it('i file ripristinati vanno nella spinta del frame, anche senza altre modifiche, e poi il link li dimentica', async () => {
    await frameRestore(deps(), 'v1');

    const out = await framesPush(pushDeps(), scope, { name: 'restore', nodeIds: ['n1'] });

    expect(out).toMatchObject({ ok: true, branch: 'feega/restore' });
    expect(gh.files('feega/restore')['src/Hero.tsx']).toBe('old hero\n');
    expect(links.get('n1')?.restored).toEqual([]);
  });

  it('lo stato del frame è modificato finché il ripristino non è spinto', async () => {
    await frameRestore(deps(), 'v1');

    expect(await frameStatus(pushDeps(), scope, 'n1')).toMatchObject({ ok: true, state: LinkState.Modified });
  });
});
