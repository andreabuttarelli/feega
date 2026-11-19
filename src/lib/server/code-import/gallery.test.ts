import { describe, expect, it } from 'vitest';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { discover } from './component-discovery';
import { Framework } from '@feega/dev-run/run-plan';
import { galleryCells, galleryOf, galleryOrder, galleryStates, GALLERY_LIMITS, isGalleryFile, NOT_DRAWN, type GalleryApp } from './gallery';

const BUTTON = `import { cva, type VariantProps } from 'class-variance-authority';
const buttonVariants = cva('', { variants: { variant: { default: '', outline: '' }, size: { default: '', sm: '' } }, defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ variant, size, asChild = false, disabled = false, ...props }: { asChild?: boolean; disabled?: boolean } & VariantProps<typeof buttonVariants>) { return <button />; }`;

const LIBRARY = discover({
  'apps/web/components/ui/button.tsx': BUTTON,
  'apps/web/components/Card.tsx': `export default function Card({ title, level = 1 }: { title: string; level?: 1 | 2 }) { return <div />; }`,
  'apps/web/components/Header.tsx': `import 'server-only';\nexport function Header() { return <header />; }`
});

const files = (...paths: string[]) => paths;
const reading = (texts: Record<string, string>) => async (paths: string[]) => Object.fromEntries(paths.flatMap((p) => (p in texts ? [[p, texts[p]]] : [])));
const app = (framework: Framework, listed: string[]): GalleryApp => ({ framework, appDir: 'apps/web', files: listed });

describe('galleryCells', () => {
  it('every declared combination, typed, with defaults and false left out so a cell matches a page usage without the prop', () => {
    const button = LIBRARY.components.find((c) => c.name === 'Button')!;

    expect(galleryCells(button)).toEqual([{}, { size: 'sm' }, { variant: 'outline' }, { variant: 'outline', size: 'sm' }, { disabled: true }, { disabled: true, size: 'sm' }, { disabled: true, variant: 'outline' }, { disabled: true, variant: 'outline', size: 'sm' }]);
  });

  it('a numeric union value is a number, a text prop gets the component name', () => {
    const card = LIBRARY.components.find((c) => c.name === 'Card')!;

    expect(galleryCells(card)).toEqual([{ title: 'Card' }, { title: 'Card', level: 2 }]);
  });
});

describe('galleryOf', () => {
  it('Next app router: one client page under the root layout, importing each library file relatively', async () => {
    const made = await galleryOf(LIBRARY, app(Framework.Next, files('apps/web/app/layout.tsx', 'apps/web/app/page.tsx')), reading({}));

    expect('files' in made && made.files.map((f) => f.path)).toEqual(['apps/web/app/feega-gallery/page.tsx']);
    const page = 'files' in made ? made.files[0].content : '';
    expect(page.startsWith("'use client';")).toBe(true);
    expect(page).toContain("import('../../components/ui/button')");
    expect(page).toContain("import('../../components/Card')");
    expect(page).not.toContain('Header');
    expect('plan' in made && made.plan.pages).toEqual([{ label: 'Library', path: '/feega-gallery?page=0', components: ['Button', 'Card'] }]);
  });

  it('a server-only component is left out with its reason, never silently missing', async () => {
    const made = await galleryOf(LIBRARY, app(Framework.Next, files('apps/web/src/app/layout.tsx')), reading({}));

    expect('plan' in made && made.plan.left).toEqual([{ name: 'Header', reason: 'renders only on the server' }]);
  });

  it('Next pages router: a page next to _app, so its providers wrap the gallery', async () => {
    const made = await galleryOf(LIBRARY, app(Framework.Next, files('apps/web/pages/_app.tsx', 'apps/web/pages/index.tsx')), reading({}));

    expect('files' in made && made.files.map((f) => f.path)).toEqual(['apps/web/pages/feega-gallery.tsx']);
  });

  it('Vite + React: a copy of index.html pointing at a gallery entry beside the real one, with its stylesheets', async () => {
    const texts = {
      'apps/web/index.html': '<!doctype html><html><head><link rel="preconnect" href="https://fonts.gstatic.com"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      'apps/web/src/main.tsx': "import { createRoot } from 'react-dom/client';\nimport './index.css';\nimport '@/styles/theme.css'\nimport App from './App';\ncreateRoot(document.getElementById('root')!).render(<App />);"
    };
    const made = await galleryOf(LIBRARY, app(Framework.Vite, files('apps/web/index.html', 'apps/web/src/main.tsx')), reading(texts));

    expect('files' in made && made.files.map((f) => f.path)).toEqual(['apps/web/feega-gallery.html', 'apps/web/src/feega-gallery.tsx']);
    const [html, entry] = 'files' in made ? made.files.map((f) => f.content) : [];
    expect(html).toContain('<script type="module" src="/src/feega-gallery.tsx"></script>');
    expect(html).toContain('fonts.gstatic.com');
    expect(entry).toContain("import './index.css';");
    expect(entry).toContain("import '@/styles/theme.css';");
    expect(entry).toContain("import('../components/ui/button')");
    expect(entry).toContain('createRoot');
    expect('plan' in made && made.plan.pages[0].path).toBe('/feega-gallery.html?page=0');
  });

  it('a framework with no gallery yet says so, and nothing is written', async () => {
    expect(await galleryOf(LIBRARY, app(Framework.SvelteKit, files('src/routes/+page.svelte')), reading({}))).toEqual({ unrun: 'no component gallery for sveltekit apps yet' });
    expect(await galleryOf(LIBRARY, app(Framework.Vite, files('apps/web/index.html')), reading({ 'apps/web/index.html': '<script type="module" src="/src/main.ts"></script>', 'apps/web/src/main.ts': "import { createApp } from 'vue';" }))).toEqual({ unrun: 'no component gallery for vite apps that do not render with React yet' });
  });

  it('a page holds at most the cells one capture can mark; the pages with most components no route captured go first', async () => {
    const many = discover(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`apps/web/components/C${i}.tsx`, `export function C${i}({ tone }: { tone?: 'a' | 'b' | 'c' | 'd' }) { return <i />; }`])));
    const made = await galleryOf(many, app(Framework.Next, files('apps/web/app/layout.tsx')), reading({}));
    const pages = 'plan' in made ? made.plan.pages : [];

    expect(pages.map((p) => [p.label, p.components.length])).toEqual([
      ['Library', 30],
      ['Library 2', 10]
    ]);
    expect(pages[0].components.length * 4).toBeLessThanOrEqual(GALLERY_LIMITS.cellsPerPage);
    expect(galleryOrder(pages, new Set(pages[0].components.slice(0, 25))).map((p) => p.label)).toEqual(['Library 2', 'Library']);
  });
});

const text = (id: string, characters: string) => ({ id, type: 'TEXT', characters });
const tree = (children: unknown[]): PageTree => ({ title: '', url: 'https://sb.test/feega-gallery', width: 1280, height: 800, truncated: false, root: { id: 'r', type: 'FRAME', children } }) as unknown as PageTree;

describe('galleryStates', () => {
  const plan = { pages: [{ label: 'Library', path: '/feega-gallery?page=0', components: ['Button', 'Card', 'Sidebar', 'Dialog'] }, { label: 'Library 2', path: '/feega-gallery?page=1', components: ['Chart'] }], left: [{ name: 'Header', reason: 'renders only on the server' }] };

  it('drawn when a cell was marked; otherwise the reason the gallery printed, nothing visible, or out of time', () => {
    const captures = [{ label: 'Library', tree: tree([text('a', `${NOT_DRAWN}Card: Cannot read properties of undefined (reading 'map')`), text('b', `${NOT_DRAWN}Sidebar: useSidebar must be used within a SidebarProvider.`)]), uses: [{ component: 'Button', props: {} }] }];

    expect(Object.fromEntries(galleryStates(plan, captures, new Set(['Library 2'])))).toEqual({
      Button: { drawn: true },
      Card: { drawn: false, reason: "Cannot read properties of undefined (reading 'map')" },
      Sidebar: { drawn: false, reason: 'useSidebar must be used within a SidebarProvider.' },
      Dialog: { drawn: false, reason: 'rendered nothing visible on its own' },
      Chart: { drawn: false, reason: 'left out, the import ran out of time' },
      Header: { drawn: false, reason: 'renders only on the server' }
    });
  });
});

describe('isGalleryFile', () => {
  it('names the files the gallery writes and nothing of the app', () => {
    expect(['app/feega-gallery/page.tsx', 'src/feega-gallery.tsx', 'feega-gallery.html', 'pages/feega-gallery.tsx'].every(isGalleryFile)).toBe(true);
    expect(['app/gallery/page.tsx', 'src/components/feega.tsx'].some(isGalleryFile)).toBe(false);
  });
});
