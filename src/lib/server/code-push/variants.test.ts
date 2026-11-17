import { describe, expect, it } from 'vitest';
import { linkSchema, EntryKind } from './link';
import { memoryLinks } from './github-sync.fixture';
import { frameVariant, routeFileOf, suggestedRoute } from './variants';

const page = (route: string, entry: string) => linkSchema.parse({ repo: 'acme/shop', entryKind: EntryKind.Page, entry, route, baseBranch: 'main', baseSha: 'c1', pushBranch: 'feega/x', pushSha: 'c2' });

describe('una variante', () => {
  it('nasce come copia del frame con i link che puntano all’originale, senza la spinta di lui', async () => {
    const links = memoryLinks();
    await links.save('a', page('/pricing', 'app/pricing/page.tsx'));

    const made = await frameVariant({ links, duplicate: async () => 'b' }, 'a');

    expect(made).toEqual({ ok: true, nodeId: 'b', links: 1 });
    expect(await links.read('b')).toMatchObject({ variantOf: 'a', entry: 'app/pricing/page.tsx', pushBranch: undefined });
  });

  it('un frame senza link non fa varianti', async () => {
    expect(await frameVariant({ links: memoryLinks(), duplicate: async () => 'b' }, 'a')).toEqual({ ok: false, refusal: 'not_linked' });
  });

  it('il file di una nuova rotta segue la convenzione della pagina di partenza', () => {
    expect(routeFileOf(page('/pricing', 'app/pricing/page.tsx'), '/pricing-b')).toBe('app/pricing-b/page.tsx');
    expect(routeFileOf(page('/', 'app/page.tsx'), '/home-b')).toBe('app/home-b/page.tsx');
    expect(routeFileOf(page('/', 'src/routes/+page.svelte'), '/b')).toBe('src/routes/b/+page.svelte');
    expect(suggestedRoute('/pricing')).toBe('/pricing-variant');
  });
});
