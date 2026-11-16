import { posix } from 'node:path';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse, PropValue } from './component-marks';
import { AxisSource, cellsOf, ExportKind, type DiscoveredComponent, type Discovery, type Drawing, type ReadMany } from './component-discovery';
import { Framework } from './run-plan';

export const GALLERY_NAME = 'feega-gallery';
export const GALLERY_READY = '[data-feega-gallery="ready"]';
export const NOT_DRAWN = 'Not drawn: ';
export const GALLERY_LIMITS = { cellsPerPage: 120, readyMs: 45_000 };

const GALLERY_LABEL = 'Library';
const SKIPPED_AXES = new Set(['asChild']);
const CHILDREN = 'children';
const NUMBER = /^-?\d+(\.\d+)?$/;
const SCRIPT_FILE = /\.(tsx|jsx|ts|js)$/;
const MODULE_ENTRY = /<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["'][^>]*>/;
const STYLE_IMPORT = /^\s*import\s+['"]([^'"]+\.(?:css|scss|sass|less))['"];?\s*$/gm;
const RENDERS_REACT = /react-dom|createRoot/;
const SERVER_ONLY = 'renders only on the server';
const NOT_SCRIPT = 'not a script component the React gallery can import';
const NOTHING_VISIBLE = 'rendered nothing visible on its own';
const OUT_OF_TIME = 'left out, the import ran out of time';

export const isGalleryFile = (path: string) => posix.basename(path).startsWith(GALLERY_NAME) || path.split('/').includes(GALLERY_NAME);

export type GalleryFile = { path: string; content: string };
export type GalleryPage = { label: string; path: string; components: string[] };
export type Unrendered = { name: string; reason: string };
export type GalleryPlan = { pages: GalleryPage[]; left: Unrendered[] };
export type GalleryUnrun = { unrun: string };
export type GalleryMade = { files: GalleryFile[]; plan: GalleryPlan } | GalleryUnrun;
export type GalleryApp = { framework: Framework; appDir: string; files: string[] };
export type GalleryCapture = { label: string; tree: PageTree; uses: ComponentUse[] };

type Cells = Record<string, PropValue>[];
type Entry = { component: DiscoveredComponent; cells: Cells };
type Site = { dir: string; route: string; written: (gallery: string) => GalleryFile[] };
type Placer = (app: GalleryApp, read: ReadMany) => Promise<Site | GalleryUnrun>;

const valueOf = (raw: string, evidence: AxisSource[]): PropValue => {
  if (evidence.includes(AxisSource.Boolean)) {
    return raw === 'true';
  }
  return NUMBER.test(raw) ? Number(raw) : raw;
};

export function galleryCells(component: DiscoveredComponent): Cells {
  const axes = Object.fromEntries(Object.entries(component.axes).filter(([name]) => !SKIPPED_AXES.has(name)));
  const texts = Object.fromEntries(component.texts.filter((t) => t !== CHILDREN).map((t) => [t, component.name]));
  return cellsOf({ ...component, axes }).map((cell) => {
    const set = Object.entries(cell).filter(([name, raw]) => raw !== axes[name].default && !(axes[name].evidence.includes(AxisSource.Boolean) && raw === 'false'));
    return { ...texts, ...Object.fromEntries(set.map(([name, raw]) => [name, valueOf(raw, axes[name].evidence)])) };
  });
}

const within = (dir: string, path: string) => (dir ? `${dir}/${path}` : path);

const importPath = (from: string, file: string) => {
  const path = posix.relative(from, file.replace(SCRIPT_FILE, ''));
  return path.startsWith('.') ? path : `./${path}`;
};

const dirWith = (app: GalleryApp, dirs: string[], has: (file: string, dir: string) => boolean) => dirs.map((d) => within(app.appDir, d)).find((dir) => app.files.some((f) => has(f, dir)));

const nextApp: Placer = async (app) => {
  const dir = dirWith(app, ['app', 'src/app'], (f, d) => posix.dirname(f) === d && posix.basename(f).startsWith('layout.'));
  return dir ? { dir: `${dir}/${GALLERY_NAME}`, route: `/${GALLERY_NAME}`, written: (gallery) => [{ path: `${dir}/${GALLERY_NAME}/page.tsx`, content: `'use client';\n${gallery}` }] } : { unrun: 'no app or pages folder found for the gallery' };
};

const nextPages: Placer = async (app) => {
  const dir = dirWith(app, ['pages', 'src/pages'], (f, d) => f.startsWith(`${d}/`));
  return dir ? { dir, route: `/${GALLERY_NAME}`, written: (gallery) => [{ path: `${dir}/${GALLERY_NAME}.tsx`, content: gallery }] } : { unrun: 'no app or pages folder found for the gallery' };
};

const firstPlaced = (...placers: Placer[]): Placer => async (app, read) => {
  let last: Site | GalleryUnrun = { unrun: 'no gallery site' };
  for (const placer of placers) {
    last = await placer(app, read);
    if ('dir' in last) {
      return last;
    }
  }
  return last;
};

const viteReact: Placer = async (app, read) => {
  const indexPath = within(app.appDir, 'index.html');
  const index = (await read([indexPath]))[indexPath];
  const src = index?.match(MODULE_ENTRY)?.[1];
  if (!index || !src) {
    return { unrun: 'no index.html with a module entry for the gallery' };
  }
  const entryPath = posix.normalize(within(app.appDir, src.replace(/^\.?\//, '')));
  const entry = (await read([entryPath]))[entryPath] ?? '';
  if (!RENDERS_REACT.test(entry)) {
    return { unrun: 'no component gallery for vite apps that do not render with React yet' };
  }
  const dir = posix.dirname(entryPath);
  const galleryPath = `${dir}/${GALLERY_NAME}.tsx`;
  const styles = [...entry.matchAll(STYLE_IMPORT)].map((m) => `import '${m[1]}';`).join('\n');
  const html = index.replace(src, `/${posix.relative(app.appDir, galleryPath)}`);
  return {
    dir,
    route: `/${GALLERY_NAME}.html`,
    written: (gallery) => [
      { path: within(app.appDir, `${GALLERY_NAME}.html`), content: html },
      { path: galleryPath, content: `${styles}\nimport { createRoot } from 'react-dom/client';\n${gallery}\ncreateRoot(document.body.appendChild(document.createElement('div'))).render(<FeegaGallery />);\n` }
    ]
  };
};

const unsupported = (framework: Framework): Placer => async () => ({ unrun: `no component gallery for ${framework} apps yet` });

const PLACERS: Record<Framework, Placer> = {
  [Framework.Next]: firstPlaced(nextApp, nextPages),
  [Framework.Vite]: viteReact,
  [Framework.SvelteKit]: unsupported(Framework.SvelteKit),
  [Framework.Nuxt]: unsupported(Framework.Nuxt),
  [Framework.Astro]: unsupported(Framework.Astro),
  [Framework.ReactRouter]: unsupported(Framework.ReactRouter),
  [Framework.Gatsby]: unsupported(Framework.Gatsby),
  [Framework.Angular]: unsupported(Framework.Angular),
  [Framework.Cra]: unsupported(Framework.Cra),
  [Framework.Generic]: unsupported(Framework.Generic)
};

function chunked(entries: Entry[]): Entry[][] {
  const pages: Entry[][] = [];
  let cells = Infinity;
  for (const entry of entries) {
    if (cells + entry.cells.length > GALLERY_LIMITS.cellsPerPage) {
      pages.push([]);
      cells = 0;
    }
    pages.at(-1)!.push(entry);
    cells += entry.cells.length;
  }
  return pages;
}

const labelOf = (i: number) => (i ? `${GALLERY_LABEL} ${i + 1}` : GALLERY_LABEL);

const exportOf = (c: DiscoveredComponent) => (c.exported === ExportKind.Default ? 'default' : c.name);

function reactGallery(dir: string, pages: Entry[][]): string {
  const files = [...new Set(pages.flat().map((e) => e.component.file))];
  const loads = files.map((f, i) => `  ${i}: () => import('${importPath(dir, f)}'),`).join('\n');
  const data = pages.map((page) => page.map((e) => ({ m: files.indexOf(e.component.file), x: exportOf(e.component), n: e.component.name, cells: e.cells })));
  return REACT_GALLERY.replace('__LOADS__', loads).replace('__PAGES__', JSON.stringify(data)).replace('__NOT_DRAWN__', JSON.stringify(NOT_DRAWN));
}

export async function galleryOf(library: Discovery, app: GalleryApp, read: ReadMany): Promise<GalleryMade> {
  const site = await PLACERS[app.framework](app, read);
  if ('unrun' in site) {
    return site;
  }
  const left = library.components.flatMap((c) => (c.serverOnly ? [{ name: c.name, reason: SERVER_ONLY }] : SCRIPT_FILE.test(c.file) ? [] : [{ name: c.name, reason: NOT_SCRIPT }]));
  const out = new Set(left.map((l) => l.name));
  const pages = chunked(library.components.filter((c) => !out.has(c.name)).map((component) => ({ component, cells: galleryCells(component) })));
  const plan = { pages: pages.map((page, i) => ({ label: labelOf(i), path: `${site.route}?page=${i}`, components: page.map((e) => e.component.name) })), left };
  return { files: pages.length ? site.written(reactGallery(site.dir, pages)) : [], plan };
}

export const galleryOrder = (pages: GalleryPage[], captured: ReadonlySet<string>): GalleryPage[] => pages.toSorted((a, b) => b.components.filter((n) => !captured.has(n)).length - a.components.filter((n) => !captured.has(n)).length);

const textsIn = (node: RestNode): string[] => [...(node.characters ? [node.characters] : []), ...(node.children ?? []).flatMap(textsIn)];

function notesIn(tree: PageTree): Map<string, string> {
  const notes = new Map<string, string>();
  for (const text of textsIn(tree.root).filter((t) => t.startsWith(NOT_DRAWN))) {
    const rest = text.slice(NOT_DRAWN.length);
    const at = rest.indexOf(': ');
    if (at > 0 && !notes.has(rest.slice(0, at))) {
      notes.set(rest.slice(0, at), rest.slice(at + 2));
    }
  }
  return notes;
}

export function galleryStates(plan: GalleryPlan, captures: GalleryCapture[], missed: ReadonlySet<string>): Map<string, Drawing> {
  const states = new Map<string, Drawing>();
  for (const page of plan.pages) {
    const capture = captures.find((c) => c.label === page.label);
    const drawn = new Set(capture?.uses.map((u) => u.component));
    const notes = capture ? notesIn(capture.tree) : new Map<string, string>();
    for (const name of page.components) {
      const reason = missed.has(page.label) || !capture ? OUT_OF_TIME : (notes.get(name) ?? NOTHING_VISIBLE);
      states.set(name, drawn.has(name) ? { drawn: true } : { drawn: false, reason });
    }
  }
  plan.left.forEach((l) => states.set(l.name, { drawn: false, reason: l.reason }));
  return states;
}

const REACT_GALLERY = `import * as React from 'react';

const LOADS: Record<number, () => Promise<Record<string, unknown>>> = {
__LOADS__
};
const PAGES: { m: number; x: string; n: string; cells: Record<string, unknown>[] }[][] = __PAGES__;
const NOT_DRAWN = __NOT_DRAWN__;

type Loaded = { mod?: Record<string, unknown>; error?: string };
type Entry = (typeof PAGES)[number][number];

const reason = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

class Boundary extends React.Component<{ fallback: (why: string) => React.ReactNode; children?: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: reason(e) };
  }
  render() {
    return this.state.error === null ? this.props.children : this.props.fallback(this.state.error);
  }
}

function Note({ name, why }: { name: string; why: string }) {
  return <p style={{ margin: 0, font: '12px/1.4 ui-monospace, monospace', color: '#b42318' }}>{NOT_DRAWN + name + ': ' + why}</p>;
}

function Cell({ C, name, props }: { C: React.ElementType; name: string; props: Record<string, unknown> }) {
  return (
    <Boundary fallback={() => <Boundary fallback={(why) => <Note name={name} why={why} />}><C {...props} /></Boundary>}>
      <C {...props}>{name}</C>
    </Boundary>
  );
}

function Section({ entry, loaded }: { entry: Entry; loaded: Loaded | undefined }) {
  if (!loaded) {
    return <Note name={entry.n} why="still loading when captured" />;
  }
  if (loaded.error !== undefined) {
    return <Note name={entry.n} why={'import failed: ' + loaded.error} />;
  }
  const C = loaded.mod?.[entry.x] as React.ElementType | undefined;
  if (!C) {
    return <Note name={entry.n} why={'the file does not export ' + entry.x} />;
  }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, font: '600 12px/1.4 ui-sans-serif, system-ui, sans-serif', color: '#71717a' }}>{entry.n}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {entry.cells.map((props, i) => (
          <div key={i} data-feega-cell={entry.n} data-feega-props={JSON.stringify(props)} style={{ padding: 8 }}>
            <Cell C={C} name={entry.n} props={props} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FeegaGallery() {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loaded, setLoaded] = React.useState<Record<number, Loaded> | null>(null);
  React.useEffect(() => {
    const page = PAGES[Number(new URLSearchParams(window.location.search).get('page') ?? 0)] ?? [];
    const wanted = [...new Set(page.map((e) => e.m))];
    setEntries(page);
    Promise.allSettled(wanted.map((m) => LOADS[m]())).then((settled) => setLoaded(Object.fromEntries(settled.map((s, i) => [wanted[i], s.status === 'fulfilled' ? { mod: s.value } : { error: reason(s.reason) }]))));
  }, []);
  return (
    <div data-feega-gallery={loaded ? 'ready' : 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: 32 }}>
      {entries.map((entry, i) => (
        <Section key={i} entry={entry} loaded={loaded?.[entry.m]} />
      ))}
    </div>
  );
}
`;
