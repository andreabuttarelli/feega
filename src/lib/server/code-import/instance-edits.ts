import ts from 'typescript';
import { LOOK, LookKey } from '$lib/canvas/code-look';
import { applyEdits, type Applied, type FileChange, type ReadFile, type SourceAt, type SourceEdit } from './write-back';

export enum EditTarget {
  Instance = 'instance',
  Main = 'main'
}

export type PropProposal = { component: string; usage: SourceAt; props: string[] };

export type Routed = Applied & { proposals: PropProposal[] };

type JsxTag = ts.JsxSelfClosingElement | ts.JsxOpeningElement;

type Rewrite = { start: number; end: number; text: string };

const ACCEPTS_STYLE = /\(\s*\{[^}]*\bstyle\b/;

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

function tagAt(source: string, file: string, at: SourceAt): { sf: ts.SourceFile; tag: JsxTag } | null {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offset = sf.getPositionOfLineAndCharacter(at.line - 1, at.column);
  let found: JsxTag | null = null;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.getStart(sf) === offset) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found ? { sf, tag: found } : null;
}

function textRewrite(sf: ts.SourceFile, tag: JsxTag, was: string, now: string): Rewrite | null {
  const attr = tag.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.initializer !== undefined && ts.isStringLiteral(p.initializer) && p.initializer.text === was);
  const literal = attr?.initializer as ts.StringLiteral | undefined;
  return literal ? { start: literal.getStart(sf) + 1, end: literal.getEnd() - 1, text: now } : null;
}

function styleRewrite(sf: ts.SourceFile, tag: JsxTag, css: [string, string][]): Rewrite {
  const body = css.map(([prop, value]) => `${camel(prop)}: ${JSON.stringify(value)}`).join(', ');
  const at = tag.attributes.getEnd();
  return { start: at, end: at, text: ` style={{ ${body} }}` };
}

const applied = (source: string, rewrites: Rewrite[]) => [...rewrites].sort((a, b) => b.start - a.start).reduce((text, r) => text.slice(0, r.start) + r.text + text.slice(r.end), source);

type Split = { rewrites: Map<string, Rewrite[]>; main: SourceEdit[]; proposals: PropProposal[]; skipped: string[] };

async function instanceOf(edit: SourceEdit & { usage: SourceAt }, read: ReadFile, split: Split) {
  const page = await read(edit.usage.file);
  const component = await read(edit.at.file);
  const found = page === null ? null : tagAt(page, edit.usage.file, edit.usage);
  if (!found || component === null) {
    split.skipped.push(`${edit.usage.file}:${edit.usage.line}: no instance of ${edit.at.file} at that spot`);
    return;
  }

  const rewrites = split.rewrites.get(edit.usage.file) ?? [];
  const styled: [string, string][] = [];
  const missing: string[] = [];
  for (const [key, value] of Object.entries(edit.look)) {
    const text = key === LookKey.Text ? textRewrite(found.sf, found.tag, String(edit.was[key] ?? ''), String(value)) : null;
    if (text) {
      rewrites.push(text);
      continue;
    }
    const css = LOOK[key as LookKey]?.css;
    if (css && ACCEPTS_STYLE.test(component)) {
      styled.push(css(value));
      continue;
    }
    missing.push(key);
  }
  if (styled.length) {
    rewrites.push(styleRewrite(found.sf, found.tag, styled));
  }
  split.rewrites.set(edit.usage.file, rewrites);
  if (missing.length) {
    split.proposals.push({ component: edit.at.file, usage: edit.usage, props: missing });
  }
}

export async function routedEdits(edits: SourceEdit[], read: ReadFile, target: EditTarget): Promise<Routed> {
  const split: Split = { rewrites: new Map(), main: [], proposals: [], skipped: [] };
  for (const edit of edits) {
    const { usage, ...plain } = edit;
    if (target === EditTarget.Main || !usage) {
      split.main.push(plain);
      continue;
    }
    await instanceOf({ ...edit, usage }, read, split);
  }

  const before = new Map<string, string>();
  const after = new Map<string, string>();
  for (const [path, rewrites] of split.rewrites) {
    const source = (await read(path))!;
    before.set(path, source);
    after.set(path, applied(source, rewrites));
  }
  const main = await applyEdits(split.main, async (path) => after.get(path) ?? read(path));

  const merged = new Map<string, FileChange>([...after].map(([path, text]) => [path, { path, before: before.get(path)!, after: text }]));
  for (const f of main.files) {
    merged.set(f.path, { path: f.path, before: before.get(f.path) ?? f.before, after: f.after });
  }
  return { files: [...merged.values()].filter((f) => f.before !== f.after), skipped: [...split.skipped, ...main.skipped], proposals: split.proposals };
}
