import { parse, type Node } from 'acorn';
import { full } from 'acorn-walk';
import type { CustomSource, SourceFile } from './component';

export type LintProblem = { file: SourceFile; message: string };

const ECMA_VERSION = 2022;

const LOCALE = 'the locale differs between preview and render: use format.number, format.compact or format.percent';

const FORBIDDEN_GLOBALS: Record<string, string> = {
  setTimeout: 'animate on tl, not with timers',
  setInterval: 'animate on tl, not with timers',
  setImmediate: 'animate on tl, not with timers',
  requestAnimationFrame: 'animate on tl: the frame is driven by seeking',
  cancelAnimationFrame: 'animate on tl: the frame is driven by seeking',
  requestIdleCallback: 'animate on tl, not with callbacks',
  queueMicrotask: 'build the timeline synchronously',
  fetch: 'no network: use props and assets',
  XMLHttpRequest: 'no network: use props and assets',
  WebSocket: 'no network',
  EventSource: 'no network',
  Worker: 'no workers',
  SharedWorker: 'no workers',
  importScripts: 'no network',
  eval: 'no eval',
  Function: 'no Function constructor',
  window: 'use root, not window',
  globalThis: 'use root, not globalThis',
  self: 'use root, not self',
  parent: 'no access to the editor',
  top: 'no access to the editor',
  opener: 'no access to the editor',
  frames: 'no access to other frames',
  localStorage: 'no storage',
  sessionStorage: 'no storage',
  indexedDB: 'no storage',
  caches: 'no storage',
  navigator: 'no device access',
  location: 'no navigation',
  performance: 'time comes from tl, not the clock',
  postMessage: 'no messaging',
  Intl: LOCALE
};

export const FORBIDDEN_NAMES = Object.keys(FORBIDDEN_GLOBALS);

const D3_CLOCK = 'd3 timers run on the clock: compute the state from tl progress in onUpdate';

const P5_CLOCK = 'a p5 sketch is redrawn on every seek: draw from p.frameCount, never on its own loop or clock';

const PIXI_CLOCK = 'a PixiJS ticker runs on the clock: set the stage in an onUpdate on tl and call app.render() there';

const FORBIDDEN_MEMBERS: Record<string, Record<string, string>> = {
  d3: { timer: D3_CLOCK, interval: D3_CLOCK, timeout: D3_CLOCK, now: D3_CLOCK },
  Date: { now: 'time comes from tl, not the clock' },
  Math: { random: 'use rand(), seeded per clip' },
  document: { cookie: 'no cookies', domain: 'no access', write: 'build DOM inside root', defaultView: 'use root, not window' }
};

const FORBIDDEN_PROPERTIES: Record<string, string> = {
  constructor: 'no constructor access',
  __proto__: 'no prototype access',
  transition: 'transitions run on the clock and do not seek: set the state from tl progress in onUpdate',
  loop: P5_CLOCK,
  frameRate: P5_CLOCK,
  millis: P5_CLOCK,
  deltaTime: P5_CLOCK,
  ticker: PIXI_CLOCK,
  Ticker: PIXI_CLOCK,
  toLocaleString: LOCALE,
  toLocaleDateString: LOCALE,
  toLocaleTimeString: LOCALE
};

type AnyNode = Node & Record<string, unknown>;
type Visit = (node: AnyNode, problems: string[]) => void;

const name = (node: unknown) => (node as AnyNode | undefined)?.type === 'Identifier' ? String((node as AnyNode).name) : null;

const propertyName = (node: AnyNode): string | null => {
  const property = node.property as AnyNode;
  if (!node.computed) {
    return name(property);
  }
  return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
};

const VISITS: Record<string, Visit> = {
  Identifier: (node, problems) => {
    const reason = FORBIDDEN_GLOBALS[String(node.name)];
    if (reason) {
      problems.push(`${node.name}: ${reason}`);
    }
  },
  MemberExpression: (node, problems) => {
    const object = name(node.object);
    const property = propertyName(node);
    if (!property) {
      return;
    }
    const reason = (object && FORBIDDEN_MEMBERS[object]?.[property]) || FORBIDDEN_PROPERTIES[property];
    if (reason) {
      problems.push(`${object ? `${object}.` : ''}${property}: ${reason}`);
    }
  },
  NewExpression: (node, problems) => {
    if (name(node.callee) === 'Date' && (node.arguments as unknown[]).length === 0) {
      problems.push('new Date(): time comes from tl, not the clock');
    }
  },
  CallExpression: (node, problems) => {
    if (name(node.callee) === 'Date') {
      problems.push('Date(): time comes from tl, not the clock');
    }
  },
  ImportExpression: (_, problems) => {
    problems.push('import(): no network, the allowed libraries are already loaded');
  }
};

const DECLARED_ONLY = new Set(['Identifier']);

const PATTERN_CHILDREN: Record<string, (node: AnyNode) => unknown[]> = {
  Identifier: () => [],
  ObjectPattern: (node) => (node.properties as AnyNode[]).map((p) => (p.type === 'RestElement' ? p.argument : p.value)),
  ArrayPattern: (node) => node.elements as unknown[],
  RestElement: (node) => [node.argument],
  AssignmentPattern: (node) => [node.left]
};

function bound(pattern: unknown, names: Set<string>) {
  const node = pattern as AnyNode | null;
  if (!node) {
    return;
  }
  if (node.type === 'Identifier') {
    names.add(String(node.name));
  }
  for (const child of PATTERN_CHILDREN[node.type]?.(node) ?? []) {
    bound(child, names);
  }
}

const BINDINGS: Record<string, (node: AnyNode) => unknown[]> = {
  VariableDeclarator: (node) => [node.id],
  FunctionDeclaration: (node) => [node.id, ...(node.params as unknown[])],
  FunctionExpression: (node) => [node.id, ...(node.params as unknown[])],
  ArrowFunctionExpression: (node) => node.params as unknown[],
  ClassDeclaration: (node) => [node.id],
  CatchClause: (node) => [node.param]
};

function declaredNames(program: Node): Set<string> {
  const names = new Set<string>();
  full(program, (node) => {
    for (const pattern of BINDINGS[node.type]?.(node as AnyNode) ?? []) {
      bound(pattern, names);
    }
  });
  return names;
}

function isReference(node: AnyNode, parent: AnyNode | null): boolean {
  if (!parent) {
    return true;
  }
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
    return false;
  }
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key === node && !parent.computed) {
    return false;
  }
  return true;
}

function lintJs(js: string): string[] {
  let program: Node;
  try {
    program = parse(js, { ecmaVersion: ECMA_VERSION, sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
  } catch (e) {
    const err = e as SyntaxError & { loc?: { line: number; column: number } };
    return [`syntax error at line ${err.loc?.line ?? '?'}: ${err.message.replace(/\s*\(\d+:\d+\)$/, '')}`];
  }

  const problems: string[] = [];
  const declared = declaredNames(program);
  const parents = new Map<Node, AnyNode>();
  full(program, (node) => {
    for (const child of Object.values(node as AnyNode)) {
      for (const c of Array.isArray(child) ? child : [child]) {
        if (c && typeof c === 'object' && typeof (c as AnyNode).type === 'string') {
          parents.set(c as Node, node as AnyNode);
        }
      }
    }
  });
  full(program, (node) => {
    const visit = VISITS[node.type];
    if (!visit) {
      return;
    }
    if (DECLARED_ONLY.has(node.type) && (!isReference(node as AnyNode, parents.get(node) ?? null) || declared.has(String((node as AnyNode).name)))) {
      return;
    }
    visit(node as AnyNode, problems);
  });
  return [...new Set(problems)];
}

type TextRule = { pattern: RegExp; message: string };

const CSS_RULES: TextRule[] = [
  { pattern: /@keyframes/i, message: '@keyframes: animate on tl, CSS animations do not seek' },
  { pattern: /(^|[;{\s])animation(-[a-z-]+)?\s*:/i, message: 'animation: animate on tl, CSS animations do not seek' },
  { pattern: /(^|[;{\s])transition(-[a-z-]+)?\s*:/i, message: 'transition: animate on tl, CSS transitions do not seek' },
  { pattern: /@import/i, message: '@import: no network' },
  { pattern: /@font-face/i, message: '@font-face: use DM Sans or Fragment Mono, already loaded' },
  { pattern: /url\(\s*(?!['"]?data:image\/)/i, message: 'url(: only data:image urls; pass pictures as asset props' },
  { pattern: /expression\s*\(|behavior\s*:|-moz-binding/i, message: 'legacy scripting in css' }
];

const HTML_RULES: TextRule[] = [
  { pattern: /<script\b/i, message: '<script: code goes in js' },
  { pattern: /<style\b/i, message: '<style: styles go in css' },
  { pattern: /<(iframe|object|embed|frame|frameset|portal)\b/i, message: '<iframe/<object/<embed: no nested documents' },
  { pattern: /<(link|meta|base|form)\b/i, message: '<link/<meta/<base/<form: not allowed in a component' },
  { pattern: /<(video|audio)\b/i, message: '<video/<audio: media timing belongs to Video and Audio clips' },
  { pattern: /\son[a-z]+\s*=/i, message: 'onclick/on* attributes: no inline handlers' },
  { pattern: /javascript:/i, message: 'javascript: urls are not allowed' },
  { pattern: /\s(src|href|srcset|poster|xlink:href)\s*=\s*['"]?(?!data:image\/|#)/i, message: 'src/href: only data:image urls; set pictures from asset props in js' }
];

const textProblems = (text: string, rules: TextRule[]) => rules.filter((r) => r.pattern.test(text)).map((r) => r.message);

export function lintSource(source: CustomSource): LintProblem[] {
  return [
    ...textProblems(source.html, HTML_RULES).map((message) => ({ file: 'html' as const, message })),
    ...textProblems(source.css, CSS_RULES).map((message) => ({ file: 'css' as const, message })),
    ...lintJs(source.js).map((message) => ({ file: 'js' as const, message }))
  ];
}

export function lintReport(problems: LintProblem[]): string {
  return problems.map((p) => `${p.file}: ${p.message}`).join('\n');
}
