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
  Inline = 'inline'
}

export type AddRequest = { kind: AddKind; style: AddStyle; src?: string };

type Recipe = { tag: string; text: string; attrs: string; tailwind: string; css: Record<string, string> };

const RECIPES: Record<AddKind, Recipe> = {
  [AddKind.Text]: { tag: 'p', text: 'Text', attrs: '', tailwind: '', css: {} },
  [AddKind.Heading]: { tag: 'h2', text: 'Heading', attrs: '', tailwind: 'text-2xl font-semibold', css: { 'font-size': '1.5rem', 'font-weight': '600' } },
  [AddKind.Button]: { tag: 'button', text: 'Button', attrs: '', tailwind: 'rounded-md bg-neutral-900 px-4 py-2 text-white', css: { padding: '8px 16px', 'border-radius': '6px' } },
  [AddKind.Link]: { tag: 'a', text: 'Link', attrs: ' href="#"', tailwind: 'underline', css: {} },
  [AddKind.Image]: { tag: 'img', text: '', attrs: '', tailwind: 'max-w-full', css: { 'max-width': '100%' } },
  [AddKind.Container]: { tag: 'div', text: '', attrs: '', tailwind: 'flex min-h-10 flex-col gap-2', css: { display: 'flex', 'flex-direction': 'column', gap: '8px', 'min-height': '40px' } }
};

const CONTAINER_TAGS = new Set(['div', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'ul', 'ol', 'form']);
const JSX_FILE = /\.(t|j)sx$/;

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function styling(recipe: Recipe, style: AddStyle, jsx: boolean): string {
  if (style === AddStyle.Tailwind) {
    return recipe.tailwind ? ` ${jsx ? 'className' : 'class'}="${recipe.tailwind}"` : '';
  }
  const entries = Object.entries(recipe.css);
  if (!entries.length) {
    return '';
  }
  return jsx ? ` style={{ ${entries.map(([k, v]) => `${camel(k)}: '${v}'`).join(', ')} }}` : ` style="${entries.map(([k, v]) => `${k}: ${v}`).join('; ')}"`;
}

function markupOf(req: AddRequest, jsx: boolean): string {
  const recipe = RECIPES[req.kind];
  const attrs = req.kind === AddKind.Image ? ` src="${req.src ?? ''}" alt=""` : recipe.attrs;
  const open = `<${recipe.tag}${attrs}${styling(recipe, req.style, jsx)}`;
  return req.kind === AddKind.Image ? `${open} />` : `${open}>${recipe.text}</${recipe.tag}>`;
}

function lineCol(text: string, offset: number): { line: number; col: number } {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

export async function addNode(read: ReadFile, at: LiveAt, req: AddRequest): Promise<Structured> {
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

  const markup = markupOf(req, JSX_FILE.test(at.file));
  const container = CONTAINER_TAGS.has(selected.tag) && selected.end > selected.openEnd + 1;
  const lineStart = source.lastIndexOf('\n', selected.start - 1) + 1;
  const indent = indentOf(source.slice(lineStart));
  const whole = !source.slice(lineStart, selected.start).trim() && !source.slice(selected.end, source.indexOf('\n', selected.end) < 0 ? source.length : source.indexOf('\n', selected.end)).trim();
  const spot = container ? placed(source, selected.closeStart, markup) : whole ? { at: source.indexOf('\n', selected.end) + 1 || source.length, text: `${indent}${markup}\n` } : { at: selected.end, text: `\n${indent}${markup}` };
  const glue = !container && whole && source.indexOf('\n', selected.end) < 0 ? '\n' : '';
  const after = source.slice(0, spot.at) + glue + spot.text + source.slice(spot.at);
  const start = spot.at + glue.length + spot.text.indexOf(markup);
  return { ok: true, changes: [{ path: at.file, before: source, after }], selected: { file: at.file, ...lineCol(after, start) } };
}
