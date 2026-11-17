import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { CodeSourceKind, EntryKind, linkSchema, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { localGitHost, Publish } from './local-git-host';
import { frameRebased } from './frames-push';

const commit = async (dir: string, file: string, text: string) => {
  await writeFile(join(dir, file), text);
  await git(dir, ['add', '.']);
  await git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', text]);
  return (await git(dir, ['rev-parse', 'HEAD'])).out.trim();
};

describe('dopo Update il frame è in pari', () => {
  it('il link avanza alla testa del ramo base, così lo stato non resta "più recente a monte"', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'feega-rebase-'));
    await git(dir, ['init', '-q', '-b', 'main']);
    const first = await commit(dir, 'page.tsx', 'v1');
    const second = await commit(dir, 'page.tsx', 'v2');
    const saved = new Map<string, CodeLink>([['n1', linkSchema.parse({ source: CodeSourceKind.Folder, repo: dir, entryKind: EntryKind.Page, entry: 'page.tsx', baseBranch: 'main', baseSha: first })]]);
    const links: LinkStore = { read: async (id) => saved.get(id) ?? null, all: async (id) => (saved.has(id) ? [saved.get(id)!] : []), save: async (id, l) => Boolean(saved.set(id, l)), remove: async (id) => saved.delete(id) };

    await frameRebased({ host: async () => localGitHost(dir, { publish: Publish.Local }), links }, 'n1');

    expect(saved.get('n1')?.baseSha).toBe(second);
    await rm(dir, { recursive: true, force: true });
  });
});
