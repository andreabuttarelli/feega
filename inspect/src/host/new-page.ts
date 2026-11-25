import { AddPlace, lineCol } from '@feega/live-edit/add-node';
import type { FileChange, ReadFile } from '@feega/live-edit/files';
import { Layout, layoutOf, libraryInsert, type InsertItem } from '@feega/live-edit/library-insert';
import type { Catalog } from '../../../packages/library/src/catalog';

export type NewPageAsk = { route: string; item: string | null; catalog: Catalog | null };

export type NewPageOut = { ok: true; route: string; changes: FileChange[] } | { ok: false; reason: string };

type Shape = { file: (read: ReadFile, route: string) => Promise<string | null>; body: (title: string, inner: string) => string };

const DYNAMIC = /[[\](){}]/;
const NOT_ROUTE = /[^a-z0-9/_-]+/g;
const EDGE_SLASH = /^\/+|\/+$/g;
const DUPLICATE_SLASH = /\/{2,}/g;
const MAIN_OPEN = '<main>';
const NEEDS_ROUTER = 'this project routes pages in a router config, which Feega does not edit yet: add the route there';

const heading = (title: string) => `<h1>${title}</h1>`;

const markup = (title: string, inner: string, indent: string) => `${indent}<main>\n${inner ? inner : `${indent}  ${heading(title)}`}\n${indent}</main>`;

const tsx = (title: string, inner: string) => `export default function Page() {\n  return (\n${markup(title, inner, '    ')}\n  );\n}\n`;

const svelte = (title: string, inner: string) => `${markup(title, inner, '')}\n`;

const astro = (title: string, inner: string) => `---\n---\n\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>${title}</title>\n  </head>\n  <body>\n${markup(title, inner, '    ')}\n  </body>\n</html>\n`;

const vue = (title: string, inner: string) => `<template>\n${markup(title, inner, '  ')}\n</template>\n`;

const nextDir = async (read: ReadFile) => {
  for (const base of ['app', 'src/app']) {
    const layouts = await Promise.all(['tsx', 'jsx', 'js'].map((ext) => read(`${base}/layout.${ext}`)));
    if (layouts.some((text) => text !== null)) {
      return base;
    }
  }
  return 'app';
};

const NEXT: Shape = {
  file: async (read, route) => `${await nextDir(read)}/${route}/page.${(await read('tsconfig.json')) === null ? 'jsx' : 'tsx'}`,
  body: tsx
};

const SHAPES: Partial<Record<Layout, Shape>> = {
  [Layout.Next]: NEXT,
  [Layout.SvelteKit]: { file: async (_read, route) => `src/routes/${route}/+page.svelte`, body: svelte },
  [Layout.Astro]: { file: async (_read, route) => `src/pages/${route}.astro`, body: astro },
  [Layout.Nuxt]: { file: async (read, route) => ((await read('pages/index.vue')) === null ? null : `pages/${route}.vue`), body: vue }
};

export const routeOf = (typed: string): string => typed.trim().toLowerCase().replace(/\s+/g, '-').replace(NOT_ROUTE, '').replace(DUPLICATE_SLASH, '/').replace(EDGE_SLASH, '');

const titleOf = (route: string) => {
  const last = route.split('/').at(-1) ?? route;
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
};

async function filled(read: ReadFile, file: string, text: string, catalog: Catalog, id: string): Promise<{ ok: true; changes: FileChange[] } | { ok: false; reason: string }> {
  const found = catalog.items.find((item) => item.id === id && item.tier === 'free');
  if (!found) {
    return { ok: false, reason: `no free library item ${id}` };
  }
  const item: InsertItem = { id: found.id, component: found.component, fonts: found.fonts, files: found.files };
  const staged: ReadFile = async (path) => (path === file ? text : read(path));
  const at = { file, ...lineCol(text, text.indexOf(MAIN_OPEN)) };
  const out = await libraryInsert(staged, at, AddPlace.Child, item, catalog.tokens);
  if (!out.ok) {
    return out;
  }
  return { ok: true, changes: out.changes.map((change) => (change.path === file ? { ...change, before: '' } : change)) };
}

export async function newPage(read: ReadFile, { route: typed, item, catalog }: NewPageAsk): Promise<NewPageOut> {
  const route = routeOf(typed);
  if (!route || DYNAMIC.test(typed) || route.split('/').some((part) => !part || part.startsWith('_'))) {
    return { ok: false, reason: 'type a route name, like about or blog/first' };
  }

  const layout = layoutOf(await read('package.json'));
  const shape = layout ? SHAPES[layout] : undefined;
  if (!shape) {
    return { ok: false, reason: NEEDS_ROUTER };
  }

  const file = await shape.file(read, route);
  if (!file) {
    return { ok: false, reason: 'this Nuxt project has no pages folder: add pages/index.vue first' };
  }
  if ((await read(file)) !== null) {
    return { ok: false, reason: `${file} already exists` };
  }

  const title = titleOf(route);
  if (item === null) {
    return { ok: true, route: `/${route}`, changes: [{ path: file, before: '', after: shape.body(title, '') }] };
  }
  if (!catalog) {
    return { ok: false, reason: 'the library is not available' };
  }

  const page = await filled(read, file, shape.body(title, '    '), catalog, item);
  return page.ok ? { ok: true, route: `/${route}`, changes: page.changes } : page;
}
