import ts from 'typescript';
import type { DeclAt, Declared } from './css-tokens';
import { SCALE_KEYS, configTokens, themeName } from './tailwind3';
import type { ReadFile } from './write-back';

export type ConfigRead = { declared: Declared[]; skipped: string[] };

type Tree = string | Tree[] | { [key: string]: Tree };

type Walk = { file: string; source: ts.SourceFile; positions: Map<string, DeclAt>; skipped: string[] };

const CONFIG_FILES = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs'];

export const CONFIG_FILE = /(^|\/)tailwind\.config\.[cm]?[jt]s$/;
const SHADCN_CONFIG = 'components.json';
const MAX_CONFIG_BYTES = 512 * 1024;
const MAX_HOPS = 8;
const SEPARATOR = '\u0000';
const EXTEND = 'extend';
const WRAPPERS = new Set(['defineConfig']);

const keyOf = (path: string[]) => path.join(SEPARATOR);

const isObject = (v: Tree): v is { [key: string]: Tree } => typeof v === 'object' && !Array.isArray(v);

function placeOf(w: Walk, node: ts.Node): DeclAt {
  const start = node.getStart(w.source);
  const { line, character } = w.source.getLineAndCharacterOfPosition(start);
  return { file: w.file, line: line + 1, column: character };
}

function leftOut(w: Walk, path: string[], node: ts.Node, why: string): undefined {
  const name = themeName(path);
  if (name) {
    w.skipped.push(`${name}: ${w.file}:${placeOf(w, node).line} ${why}`);
  }
  return undefined;
}

const NOT_LITERAL = 'is not a literal (a spread or a reference)';
const IS_FUNCTION = 'is a function, not a literal';

function keyName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text : null;
}

function scalar(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand) ? `-${node.operand.text}` : null;
}

function entries(w: Walk, node: ts.ObjectLiteralExpression, path: string[]): Tree {
  const out: { [key: string]: Tree } = {};
  for (const prop of node.properties) {
    const key = ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop) ? keyName(prop.name) : null;
    if (key === null || !ts.isPropertyAssignment(prop)) {
      leftOut(w, path, prop, ts.isMethodDeclaration(prop) ? IS_FUNCTION : NOT_LITERAL);
      continue;
    }
    const value = evaluated(w, prop.initializer, [...path, key]);
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function listed(w: Walk, node: ts.ArrayLiteralExpression, path: string[]): Tree | undefined {
  const items = node.elements.map((el, i) => evaluated(w, el, [...path, String(i)]));
  return items.every((item) => item !== undefined) ? (items as Tree[]) : leftOut(w, path, node, NOT_LITERAL);
}

function evaluated(w: Walk, node: ts.Expression, path: string[]): Tree | undefined {
  const text = scalar(node);
  if (text !== null) {
    w.positions.set(keyOf(path), placeOf(w, node));
    return text;
  }
  if (ts.isObjectLiteralExpression(node)) {
    w.positions.set(keyOf(path), placeOf(w, node));
    return entries(w, node, path);
  }
  if (ts.isArrayLiteralExpression(node)) {
    w.positions.set(keyOf(path), placeOf(w, node));
    return listed(w, node, path);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return leftOut(w, path, node, IS_FUNCTION);
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluated(w, node.expression, path);
  }
  return leftOut(w, path, node, NOT_LITERAL);
}

function declarationOf(source: ts.SourceFile, name: string): ts.Expression | null {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const found = statement.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name);
    if (found?.initializer) {
      return found.initializer;
    }
  }
  return null;
}

function exported(source: ts.SourceFile): ts.Expression | null {
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      return statement.expression;
    }
    const assign = ts.isExpressionStatement(statement) ? statement.expression : null;
    if (assign && ts.isBinaryExpression(assign) && assign.operatorToken.kind === ts.SyntaxKind.EqualsToken && assign.left.getText(source) === 'module.exports') {
      return assign.right;
    }
  }
  return null;
}

function objectOf(source: ts.SourceFile, start: ts.Expression | null): ts.ObjectLiteralExpression | null {
  let node = start;
  for (let hop = 0; node && hop < MAX_HOPS; hop++) {
    if (ts.isObjectLiteralExpression(node)) {
      return node;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) {
      node = node.expression;
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && WRAPPERS.has(node.expression.text) && node.arguments.length === 1) {
      node = node.arguments[0];
    } else if (ts.isIdentifier(node)) {
      node = declarationOf(source, node.text);
    } else {
      return null;
    }
  }
  return null;
}

function property(node: ts.ObjectLiteralExpression, name: string): ts.Expression | null {
  const found = node.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && keyName(p.name) === name);
  return found?.initializer ?? null;
}

function merged(base: Tree | undefined, over: Tree | undefined): Tree | undefined {
  if (base === undefined || over === undefined) {
    return over ?? base;
  }
  if (isObject(base) && isObject(over)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(over)]);
    return Object.fromEntries([...keys].map((k) => [k, merged(base[k], over[k])!]));
  }
  return over;
}

const NOT_A_SCALE = 'not a token scale feega reads';

function scales(w: Walk, theme: ts.ObjectLiteralExpression): { [key: string]: Tree } {
  const out: { [key: string]: Tree } = {};
  const unread = new Set<string>();
  const [extensions, own] = [theme.properties.filter((p) => ts.isPropertyAssignment(p) && keyName(p.name) === EXTEND), theme.properties.filter((p) => !(ts.isPropertyAssignment(p) && keyName(p.name) === EXTEND))];
  const members = [...own, ...extensions.flatMap((p) => (ts.isPropertyAssignment(p) ? (objectOf(w.source, p.initializer)?.properties ?? []) : []))];

  for (const prop of members) {
    const key = ts.isPropertyAssignment(prop) ? keyName(prop.name) : null;
    if (key === null || !ts.isPropertyAssignment(prop)) {
      w.skipped.push(`theme: ${w.file}:${placeOf(w, prop).line} ${NOT_LITERAL}`);
      continue;
    }
    if (!SCALE_KEYS.includes(key)) {
      unread.add(key);
      continue;
    }
    const value = evaluated(w, prop.initializer, [key]);
    if (value !== undefined) {
      out[key] = merged(out[key], value)!;
    }
  }
  w.skipped.push(...[...unread].map((k) => `theme.${k}: ${NOT_A_SCALE}`));
  return out;
}

export function readConfigText(text: string, file: string): ConfigRead {
  const kind = file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const config = objectOf(source, exported(source));
  const themeNode = config ? property(config, 'theme') : null;
  const theme = themeNode ? objectOf(source, themeNode) : null;
  if (!themeNode || !theme) {
    return { declared: [], skipped: themeNode ? [`theme: ${file}:${source.getLineAndCharacterOfPosition(themeNode.getStart(source)).line + 1} ${NOT_LITERAL}`] : [] };
  }

  const w: Walk = { file, source, positions: new Map(), skipped: [] };
  const resolved = scales(w, theme);
  const at = (path: string[]) => w.positions.get(keyOf(path)) ?? { file, line: 1, column: 0 };
  return { declared: configTokens({ theme: resolved }, file, at), skipped: w.skipped };
}

async function configPath(read: ReadFile): Promise<string[]> {
  const raw = await read(SHADCN_CONFIG).catch(() => null);
  try {
    const path = raw ? (JSON.parse(raw) as { tailwind?: { config?: unknown } }).tailwind?.config : undefined;
    return typeof path === 'string' && path ? [path.replace(/^\.\//, '')] : [];
  } catch {
    return [];
  }
}

export async function readTailwindConfig(read: ReadFile): Promise<ConfigRead> {
  for (const path of [...(await configPath(read)), ...CONFIG_FILES]) {
    const text = await read(path).catch(() => null);
    if (text === null || text.length > MAX_CONFIG_BYTES) {
      continue;
    }
    return readConfigText(text, path);
  }
  return { declared: [], skipped: [] };
}
