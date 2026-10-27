import ts from 'typescript';
import { parse } from 'svelte/compiler';
import { VAR_SHORTHANDS, isCodeFiles, isVarValues, type CodeFiles } from '$lib/canvas/code-frame';
import { checkVarValues, varDecl, type VarDecl } from '$lib/canvas/code-vars';

const RUNTIME_GLOBAL = 'feega';
const IFRAME_TYPE = 'iframe';

export const NOT_LITERAL = Symbol('not literal');

type Literal = unknown;

export type FeegaCall = { path: string; fn: string; name: Literal; spec: Literal; start: number; end: number };

function tsLiteral(node: ts.Expression | undefined): Literal {
  if (!node) {
    return undefined;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return node.kind === ts.SyntaxKind.TrueKeyword;
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return tsLiteral(node.expression);
  }
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map((e) => tsLiteral(e));
    return items.includes(NOT_LITERAL) ? NOT_LITERAL : items;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const entries = node.properties.map((p) => (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text, tsLiteral(p.initializer)] : null));
    return entries.some((e) => e === null || e[1] === NOT_LITERAL) ? NOT_LITERAL : Object.fromEntries(entries as [string, Literal][]);
  }
  return NOT_LITERAL;
}

const SCRIPT_KIND: [RegExp, ts.ScriptKind][] = [
  [/\.tsx$/, ts.ScriptKind.TSX],
  [/\.jsx$/, ts.ScriptKind.JSX],
  [/\.js$/, ts.ScriptKind.JS],
  [/./, ts.ScriptKind.TS]
];

function scriptCalls(path: string, source: string, offset = 0): FeegaCall[] {
  const kind = SCRIPT_KIND.find(([test]) => test.test(path))![1];
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const calls: FeegaCall[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === RUNTIME_GLOBAL) {
      const [name, spec] = node.arguments;
      calls.push({ path, fn: node.expression.name.text, name: tsLiteral(name), spec: tsLiteral(spec), start: offset + node.getStart(file), end: offset + node.end });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return calls;
}

type EsNode = { type: string; start: number; end: number; [key: string]: unknown };

const isNode = (x: unknown): x is EsNode => typeof x === 'object' && x !== null && typeof (x as EsNode).type === 'string';

function esLiteral(node: EsNode | undefined): Literal {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0) {
    return (node.quasis as { value: { cooked: string } }[])[0].value.cooked;
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && isNode(node.argument) && typeof node.argument.value === 'number') {
    return -node.argument.value;
  }
  if (node.type === 'ArrayExpression') {
    const items = (node.elements as EsNode[]).map(esLiteral);
    return items.includes(NOT_LITERAL) ? NOT_LITERAL : items;
  }
  if (node.type === 'ObjectExpression') {
    const entries = (node.properties as EsNode[]).map((p) => {
      const key = p.key as EsNode | undefined;
      const name = key?.type === 'Identifier' ? key.name : key?.type === 'Literal' ? key.value : undefined;
      return p.type === 'Property' && typeof name === 'string' ? [name, esLiteral(p.value as EsNode)] : null;
    });
    return entries.some((e) => e === null || e[1] === NOT_LITERAL) ? NOT_LITERAL : Object.fromEntries(entries as [string, Literal][]);
  }
  return NOT_LITERAL;
}

function svelteCalls(path: string, source: string): FeegaCall[] {
  const calls: FeegaCall[] = [];
  const seen = new WeakSet<object>();

  const walk = (value: unknown) => {
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      return;
    }
    seen.add(value);

    if (isNode(value) && value.type === 'CallExpression') {
      const callee = value.callee as EsNode;
      const object = callee?.object as EsNode | undefined;
      if (callee?.type === 'MemberExpression' && object?.type === 'Identifier' && object.name === RUNTIME_GLOBAL) {
        const [name, spec] = value.arguments as EsNode[];
        calls.push({ path, fn: String((callee.property as EsNode).name), name: esLiteral(name), spec: esLiteral(spec), start: value.start, end: value.end });
      }
    }
    for (const child of Object.values(value)) {
      walk(child);
    }
  };
  walk(parse(source, { modern: true }));

  return calls.sort((a, b) => a.start - b.start);
}

const CALLS_BY_EXTENSION: [RegExp, (path: string, source: string) => FeegaCall[]][] = [
  [/\.svelte$/, svelteCalls],
  [/\.(tsx?|jsx?)$/, (path, source) => scriptCalls(path, source)],
  [/./, () => []]
];

export function feegaCalls(path: string, source: string): FeegaCall[] {
  return CALLS_BY_EXTENSION.find(([test]) => test.test(path))![1](path, source);
}

export function declarationOf(call: FeegaCall): VarDecl | null {
  const shorthand = VAR_SHORTHANDS[call.fn];
  if (!shorthand || typeof call.name !== 'string' || call.spec === NOT_LITERAL) {
    return null;
  }
  return varDecl(call.name, call.spec, shorthand);
}

export function declaredVars(files: CodeFiles): VarDecl[] {
  const found = new Map<string, VarDecl>();
  for (const [path, source] of Object.entries(files)) {
    for (const call of feegaCalls(path, source)) {
      const decl = declarationOf(call);
      if (decl && !found.has(decl.name)) {
        found.set(decl.name, decl);
      }
    }
  }
  return [...found.values()];
}

export function codeVarsError(type: string, data: Record<string, unknown>): string | null {
  if (type !== IFRAME_TYPE || !isCodeFiles(data.files) || !isVarValues(data.vars)) {
    return null;
  }

  let decls: VarDecl[];
  try {
    decls = declaredVars(data.files);
  } catch {
    return null;
  }

  const verdict = checkVarValues(decls, data.vars);
  return verdict.ok ? null : verdict.error;
}
