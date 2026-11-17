import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { CodeSourceKind, EntryKind, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { localGitHost, Publish } from './local-git-host';
import { importLink, linkImported } from './import-link';

const route = (path: string, file: string, params: string[] = []) => ({ path, file, params });

const imported = {
  source: CodeSourceKind.Folder,
  repo: '/work/shop',
  appRoot: 'apps/web',
  baseBranch: 'main',
  baseSha: 'abc1234',
  landed: ['/', '/pricing'],
  routes: [route('/', 'app/page.tsx'), route('/pricing', 'app/pricing/page.tsx'), route('/blog/[slug]', 'app/blog/[slug]/page.tsx', ['slug'])]
};

describe('il link creato all’import', () => {
  it('la prima pagina importata è l’entry, le pagine importate sono i file', () => {
    expect(importLink(imported)).toMatchObject({ entryKind: EntryKind.Page, entry: 'app/page.tsx', route: '/', appRoot: 'apps/web', baseBranch: 'main', baseSha: 'abc1234', files: ['app/page.tsx', 'app/pricing/page.tsx'] });
  });

  it('una rotta con parametri porta i valori con cui è stata aperta', () => {
    const link = importLink({ ...imported, landed: ['/blog/hello'] });

    expect(link).toMatchObject({ entry: 'app/blog/[slug]/page.tsx', route: '/blog/[slug]', routeParams: { slug: 'hello' } });
  });

  it('nessuna pagina riconosciuta: nessun link', () => {
    expect(importLink({ ...imported, landed: ['/missing'] })).toBeNull();
  });
});

const memoryLinks = () => {
  const saved = new Map<string, CodeLink>();
  const links: LinkStore = { read: async (id) => saved.get(id) ?? null, save: async (id, l) => Boolean(saved.set(id, l)), remove: async (id) => saved.delete(id) };
  return { saved, links };
};

describe('il link salvato dopo l’import di una cartella git', () => {
  it('branch e SHA vengono dal repo, non dall’hash della cartella', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'feega-link-'));
    await git(dir, ['init', '-q', '-b', 'trunk']);
    await mkdir(join(dir, 'app'), { recursive: true });
    await writeFile(join(dir, 'app/page.tsx'), 'export default () => <h1>hi</h1>;');
    await git(dir, ['add', '.']);
    await git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init']);
    const head = (await git(dir, ['rev-parse', 'HEAD'])).out.trim();
    const { saved, links } = memoryLinks();

    await linkImported({ host: async () => localGitHost(dir, { publish: Publish.Local }), links }, 'node-1', { kind: 'folder', repo: dir, branch: null, sha: 'content-hash', routes: ['/'] }, { app: '', routes: [route('/', 'app/page.tsx')] });

    expect(saved.get('node-1')).toMatchObject({ source: CodeSourceKind.Folder, repo: dir, baseBranch: 'trunk', baseSha: head, entry: 'app/page.tsx' });
    await rm(dir, { recursive: true, force: true });
  });

  it('un upload non è pushabile: nessun link', async () => {
    const { saved, links } = memoryLinks();

    await linkImported({ host: async () => null, links }, 'node-1', { kind: 'upload', repo: 'u/x', branch: null, sha: 'x', routes: ['/'] }, { app: '', routes: [route('/', 'app/page.tsx')] });

    expect(saved.size).toBe(0);
  });
});
