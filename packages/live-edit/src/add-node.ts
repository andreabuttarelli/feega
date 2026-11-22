import { offsetOf, type LiveAt } from './class-patch';
import { elementRange } from './element-range';
import type { ReadFile } from './files';
import { indentOf, placed, type Structured } from './move-into';
import { hiddenOut, parentOf, repeated } from './move-node';

export enum AddKind {
  Text = 'text',
  Heading = 'heading',
  Button = 'button',
  Link = 'link',
  Image = 'image',
  Container = 'container'
}

export enum AddStyle {
  Tailwind = 'tailwind',
  Plain = 'plain'
}

export enum AddPlace {
  Auto = 'auto',
  Child = 'child',
  Before = 'before',
  After = 'after'
}

export type AddRequest = { kind: AddKind; style: AddStyle; src?: string; place?: AddPlace };

type Recipe = { tag: string; text: string; attrs: string; tailwind: string; css: Record<string, string> };

const RECIPES: Record<AddKind, Recipe> = {
  [AddKind.Text]: { tag: 'p', text: 'Text', attrs: '', tailwind: '', css: {} },
  [AddKind.Heading]: { tag: 'h2', text: 'Heading', attrs: '', tailwind: 'text-2xl font-semibold', css: { 'font-size': '1.5rem', 'font-weight': '600' } },
  [AddKind.Button]: { tag: 'button', text: 'Button', attrs: '', tailwind: 'rounded-md bg-neutral-900 px-4 py-2 text-white', css: { padding: '8px 16px', 'border-radius': '6px' } },
  [AddKind.Link]: { tag: 'a', text: 'Link', attrs: ' href="#"', tailwind: 'underline', css: {} },
  [AddKind.Image]: { tag: 'img', text: '', attrs: '', tailwind: 'max-w-full', css: { 'max-width': '100%' } },
  [AddKind.Container]: { tag: 'div', text: '', attrs: '', tailwind: 'flex min-h-10 flex-col gap-2', css: { display: 'flex', 'flex-direction': 'column', gap: '8px', 'min-height': '40px' } }
};

export const CONTAINER_TAGS = new Set(['div', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'ul', 'ol', 'form']);
const JSX_FILE = /\.(t|j)sx$/;

export const classAttribute = (file: string, value: string) => ` ${JSX_FILE.test(file) ? 'className' : 'class'}="${value}"`;

export const addedCss = (kind: AddKind): Record<string, string> => RECIPES[kind].css;

const styling = (recipe: Recipe, style: AddStyle, file: string) => (style === AddStyle.Tailwind && recipe.tailwind ? classAttribute(file, recipe.tailwind) : '');

function markupOf(req: AddRequest, file: string): string {
  const recipe = RECIPES[req.kind];
  const attrs = req.kind === AddKind.Image ? ` src="${req.src ?? ''}" alt=""` : recipe.attrs;
  const open = `<${recipe.tag}${attrs}${styling(recipe, req.style, file)}`;
  return req.kind === AddKind.Image ? `${open} />` : `${open}>${recipe.text}</${recipe.tag}>`;
}

function lineCol(text: string, offset: number): { line: number; col: number } {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

export const addNode = (read: ReadFile, at: LiveAt, req: AddRequest): Promise<Structured> => addMarkup(read, at, markupOf(req, at.file), req.place);

export async function addMarkup(read: ReadFile, at: LiveAt, markup: string, requested?: AddPlace): Promise<Structured> {
  const source = await read(at.file);
  if (source === null) {
    return { ok: false, reason: `${at.file}: cannot read the file` };
  }

  const text = hiddenOut(source);
  const selected = elementRange(text, offsetOf(text, at));
  if (!selected) {
    return { ok: false, reason: `${at.file}: the element is not where the page says` };
  }

  const why = repeated(text, parentOf(text, selected.start), selected.start);
  if (why) {
    return { ok: false, reason: why, at };
  }

  const place = requested ?? AddPlace.Auto;
  const holds = selected.end > selected.openEnd + 1;
  if (place === AddPlace.Child && !holds) {
    return { ok: false, reason: `<${selected.tag}> cannot hold children`, at };
  }

  const lineStart = source.lastIndexOf('\n', selected.start - 1) + 1;
  const indent = indentOf(source.slice(lineStart));
  const lineEnd = source.indexOf('\n', selected.end);
  const alone = !source.slice(lineStart, selected.start).trim() && !source.slice(selected.end, lineEnd < 0 ? source.length : lineEnd).trim();
  const mode = place === AddPlace.Auto ? (CONTAINER_TAGS.has(selected.tag) && holds ? AddPlace.Child : AddPlace.After) : place;
  const spots: Record<Exclude<AddPlace, AddPlace.Auto>, { at: number; text: string }> = {
    [AddPlace.Child]: placed(source, selected.closeStart, markup),
    [AddPlace.Before]: alone ? { at: lineStart, text: `${indent}${markup}\n` } : { at: selected.start, text: `${markup}\n${indent}` },
    [AddPlace.After]: alone ? { at: lineEnd + 1 || source.length, text: `${indent}${markup}\n` } : { at: selected.end, text: `\n${indent}${markup}` }
  };
  const spot = spots[mode];
  const glue = mode === AddPlace.After && alone && lineEnd < 0 ? '\n' : '';
  const after = source.slice(0, spot.at) + glue + spot.text + source.slice(spot.at);
  const start = spot.at + glue.length + spot.text.indexOf(markup);
  return { ok: true, changes: [{ path: at.file, before: source, after }], selected: { file: at.file, ...lineCol(after, start) } };
}
