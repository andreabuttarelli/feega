import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { CodeSourceKind, ComponentRole, EntryKind, linkKey, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { localGitHost, Publish } from './local-git-host';
import { importLinks, linkImported } from './import-link';

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

const sources: Record<string, string> = {
  'apps/web/app/page.tsx': "import { Hero } from '@/components/Hero';\nexport default () => <Hero />;",
  'apps/web/app/pricing/page.tsx': "import { Hero } from '../../components/Hero';\nexport default () => <Hero />;",
  'apps/web/components/Hero.tsx': 'export const Hero = () => <h1 />;'
};

const read = async (path: string) => sources[path] ?? null;

const pages = (links: CodeLink[]) => links.filter((l) => l.entryKind === EntryKind.Page);

describe('i link creati all’import', () => {
  it('un link per pagina importata, con il grafo degli import nei file', async () => {
    const links = await importLinks(imported, read);

    expect(pages(links)).toMatchObject([
      { entryKind: EntryKind.Page, entry: 'app/page.tsx', route: '/', appRoot: 'apps/web', baseBranch: 'main', baseSha: 'abc1234', files: ['app/page.tsx', 'components/Hero.tsx'] },
      { entry: 'app/pricing/page.tsx', route: '/pricing', files: ['app/pricing/page.tsx', 'components/Hero.tsx'] }
    ]);
  });

  it('un componente della libreria usato dalle pagine ha un link main e uno instance per pagina', async () => {
    const links = await importLinks({ ...imported, components: [{ name: 'Hero', file: 'components/Hero.tsx' }] }, read);
    const parts = links.filter((l) => l.entryKind === EntryKind.Component).map((l) => [l.role, l.entry, l.route ?? null]);

    expect(parts).toEqual([
      [ComponentRole.Main, 'components/Hero.tsx', null],
      [ComponentRole.Instance, 'components/Hero.tsx', '/'],
      [ComponentRole.Instance, 'components/Hero.tsx', '/pricing']
    ]);
  });

  it('il poster dell’import resta come miniatura "prima"', async () => {
    const links = await importLinks({ ...imported, poster: 'asset-1' }, read);

    expect(links.every((l) => l.beforePoster === 'asset-1')).toBe(true);
  });

  it('una rotta con parametri porta i valori con cui è stata aperta', async () => {
    const [link] = await importLinks({ ...imported, landed: ['/blog/hello'] }, read);

    expect(link).toMatchObject({ entry: 'app/blog/[slug]/page.tsx', route: '/blog/[slug]', routeParams: { slug: 'hello' } });
  });

  it('nessuna pagina riconosciuta: nessun link', async () => {
    expect(await importLinks({ ...imported, landed: ['/missing'] }, read)).toEqual([]);
  });
});

describe('la chiave di un link', () => {
  it('pagina, main e instance dello stesso file non si sovrascrivono', async () => {
    const links = await importLinks({ ...imported, components: [{ name: 'Hero', file: 'components/Hero.tsx' }] }, read);

    expect(new Set(links.map(linkKey)).size).toBe(links.length);
  });
});

const memoryLinks = () => {
  const saved = new Map<string, CodeLink>();
  const links: LinkStore = { read: async (id) => saved.get(id) ?? null, all: async (id) => (saved.has(id) ? [saved.get(id)!] : []), save: async (id, l) => Boolean(l.entryKind === EntryKind.Page && saved.set(id, l)), remove: async (id) => saved.delete(id) };
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
