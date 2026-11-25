import { AddPlace, lineCol } from '@feega/live-edit/add-node';
import { libraryInsert, type InsertItem } from '@feega/live-edit/library-insert';
import type { Catalog } from '../../../packages/library/src/catalog';
import type { Files } from '../init';
import { STACKS, Stack, type ProjectName } from './stacks';
import { TEMPLATES, Template } from './templates';

export type ComposeAsk = { stack: Stack; template: Template; name: string; catalog: Catalog };

export type Composed = { ok: true; files: Files } | { ok: false; reason: string };

const UNSAFE_TITLE = /[<>{}`$\\]/g;
const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASH = /^-+|-+$/g;
const MAIN_OPEN = '<main>';
const FALLBACK_NAME = 'my-app';

export function projectName(raw: string): ProjectName {
  const title = raw.replace(UNSAFE_TITLE, '').trim() || FALLBACK_NAME;
  const slug = title.toLowerCase().replace(NON_SLUG, '-').replace(EDGE_DASH, '') || FALLBACK_NAME;
  return { slug, title };
}

const withoutHeading = (text: string, title: string): string => text.replace(new RegExp(`\\n[ \\t]*<h1>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`), '');

export async function composeProject({ stack, template, name, catalog }: ComposeAsk): Promise<Composed> {
  const row = STACKS[stack];
  const project = projectName(name);
  const files: Files = row.files(project);
  const sections = TEMPLATES[template];
  if (sections.length === 0) {
    return { ok: true, files };
  }

  files[row.page] = withoutHeading(files[row.page], project.title);
  const read = async (path: string) => files[path] ?? null;

  for (const id of sections) {
    const found = catalog.items.find((item) => item.id === id && item.tier === 'free');
    if (!found) {
      return { ok: false, reason: `library item ${id} is not available` };
    }
    const item: InsertItem = { id: found.id, component: found.component, fonts: found.fonts, files: found.files };
    const page = files[row.page];
    const at = { file: row.page, ...lineCol(page, page.indexOf(MAIN_OPEN)) };
    const out = await libraryInsert(read, at, AddPlace.Child, item, catalog.tokens);
    if (!out.ok) {
      return { ok: false, reason: out.reason };
    }
    for (const change of out.changes) {
      files[change.path] = change.after;
    }
  }
  return { ok: true, files };
}
