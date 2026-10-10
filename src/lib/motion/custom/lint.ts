import { parse, type Node } from 'acorn';
import { full } from 'acorn-walk';
import { ComponentMode, type CustomSource, type SourceFile } from './component';

export type LintProblem = { file: SourceFile; message: string };

const ECMA_VERSION = 2022;

const LOCALE = 'the locale differs between preview and render: use format.number, format.compact or format.percent';

enum Concern {
  Clock = 'clock',
  Chance = 'chance',
  Sandbox = 'sandbox'
}

type Rule = { reason: string; concern: Concern };

const clock = (reason: string): Rule => ({ reason, concern: Concern.Clock });
const sandbox = (reason: string): Rule => ({ reason, concern: Concern.Sandbox });

const ALLOWED: Record<ComponentMode, ReadonlySet<Concern>> = {
  [ComponentMode.Deterministic]: new Set(),
  [ComponentMode.Live]: new Set([Concern.Clock, Concern.Chance])
};

const FORBIDDEN_GLOBALS: Record<string, Rule> = {
  setTimeout: clock('animate on tl, not with timers'),
  setInterval: clock('animate on tl, not with timers'),
  setImmediate: clock('animate on tl, not with timers'),
  requestAnimationFrame: clock('animate on tl: the frame is driven by seeking'),
  cancelAnimationFrame: clock('animate on tl: the frame is driven by seeking'),
  requestIdleCallback: clock('animate on tl, not with callbacks'),
  queueMicrotask: clock('build the timeline synchronously'),
  fetch: sandbox('no network: use props and assets'),
  XMLHttpRequest: sandbox('no network: use props and assets'),
  WebSocket: sandbox('no network'),
  EventSource: sandbox('no network'),
  Worker: sandbox('no workers'),
  SharedWorker: sandbox('no workers'),
  importScripts: sandbox('no network'),
  eval: sandbox('no eval'),
  Function: sandbox('no Function constructor'),
  window: sandbox('use root, not window'),
  globalThis: sandbox('use root, not globalThis'),
  self: sandbox('use root, not self'),
  parent: sandbox('no access to the editor'),
  top: sandbox('no access to the editor'),
  opener: sandbox('no access to the editor'),
  frames: sandbox('no access to other frames'),
  localStorage: sandbox('no storage'),
  sessionStorage: sandbox('no storage'),
  indexedDB: sandbox('no storage'),
  caches: sandbox('no storage'),
  navigator: sandbox('no device access: a live component reads input'),
  location: sandbox('no navigation'),
  performance: clock('time comes from tl, not the clock'),
  postMessage: sandbox('no messaging'),
  Intl: sandbox(LOCALE)
};

export const FORBIDDEN_NAMES = Object.keys(FORBIDDEN_GLOBALS);

const GAME_LOOP = clock('a game engine runs its own loop and reads input: declare the component live');

const GAME_ENGINES: Record<string, Rule> = { LittleJS: GAME_LOOP, kaplay: GAME_LOOP };

const D3_CLOCK = clock('d3 timers run on the clock: compute the state from tl progress in onUpdate');

const P5_CLOCK = clock('a p5 sketch is redrawn on every seek: draw from p.frameCount, never on its own loop or clock');

const PIXI_CLOCK = clock('a PixiJS ticker runs on the clock: set the stage in an onUpdate on tl and call app.render() there');

const MATTER_CLOCK = clock('matter.js loops run on the clock: Matter.seekable(engine) steps the world to the sought frame');

const WALL_CLOCK = clock('time comes from tl, not the clock');

const FORBIDDEN_MEMBERS: Record<string, Record<string, Rule>> = {
  Matter: { Runner: MATTER_CLOCK, Render: MATTER_CLOCK },
  d3: { timer: D3_CLOCK, interval: D3_CLOCK, timeout: D3_CLOCK, now: D3_CLOCK },
  Date: { now: WALL_CLOCK },
  THREE: { Clock: clock('THREE.Clock reads the wall clock: take the time from this.time() in onUpdate') },
  Math: { random: { reason: 'use rand(), seeded per clip', concern: Concern.Chance } },
  document: { cookie: sandbox('no cookies'), domain: sandbox('no access'), write: sandbox('build DOM inside root'), defaultView: sandbox('use root, not window') }
};

const FORBIDDEN_PROPERTIES: Record<string, Rule> = {
  constructor: sandbox('no constructor access'),
  __proto__: sandbox('no prototype access'),
  transition: clock('transitions run on the clock and do not seek: set the state from tl progress in onUpdate'),
  loop: P5_CLOCK,
  frameRate: P5_CLOCK,
  millis: P5_CLOCK,
  deltaTime: P5_CLOCK,
  ticker: PIXI_CLOCK,
  Ticker: PIXI_CLOCK,
  toLocaleString: sandbox(LOCALE),
  toLocaleDateString: sandbox(LOCALE),
  toLocaleTimeString: sandbox(LOCALE)
};

type AnyNode = Node & Record<string, unknown>;
type Visit = (node: AnyNode, report: (rule: Rule, what: string) => void) => void;

const name = (node: unknown) => (node as AnyNode | undefined)?.type === 'Identifier' ? String((node as AnyNode).name) : null;

const propertyName = (node: AnyNode): string | null => {
  const property = node.property as AnyNode;
  if (!node.computed) {
    return name(property);
  }
  return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
};

const VISITS: Record<string, Visit> = {
  Identifier: (node, report) => {
    const rule = FORBIDDEN_GLOBALS[String(node.name)] ?? GAME_ENGINES[String(node.name)];
    if (rule) {
      report(rule, String(node.name));
    }
  },
  MemberExpression: (node, report) => {
    const object = name(node.object);
    const property = propertyName(node);
    if (!property) {
      return;
    }
    const rule = (object && FORBIDDEN_MEMBERS[object]?.[property]) || FORBIDDEN_PROPERTIES[property];
    if (rule) {
      report(rule, `${object ? `${object}.` : ''}${property}`);
    }
  },
  NewExpression: (node, report) => {
    if (name(node.callee) === 'Date' && (node.arguments as unknown[]).length === 0) {
      report(WALL_CLOCK, 'new Date()');
    }
  },
  CallExpression: (node, report) => {
    if (name(node.callee) === 'Date') {
      report(WALL_CLOCK, 'Date()');
    }
  },
  ImportExpression: (_, report) => {
    report(sandbox('no network, the allowed libraries are already loaded'), 'import()');
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

function lintJs(js: string, allowed: ReadonlySet<Concern>): string[] {
  let program: Node;
  try {
    program = parse(js, { ecmaVersion: ECMA_VERSION, sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
  } catch (e) {
    const err = e as SyntaxError & { loc?: { line: number; column: number } };
    return [`syntax error at line ${err.loc?.line ?? '?'}: ${err.message.replace(/\s*\(\d+:\d+\)$/, '')}`];
  }

  const problems: string[] = [];
  const report = (rule: Rule, what: string) => {
    if (!allowed.has(rule.concern)) {
      problems.push(`${what}: ${rule.reason}`);
    }
  };
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
    visit(node as AnyNode, report);
  });
  return [...new Set(problems)];
}

type TextRule = { pattern: RegExp; message: string; concern?: Concern };

const CSS_RULES: TextRule[] = [
  { pattern: /@keyframes/i, message: '@keyframes: animate on tl, CSS animations do not seek', concern: Concern.Clock },
  { pattern: /(^|[;{\s])animation(-[a-z-]+)?\s*:/i, message: 'animation: animate on tl, CSS animations do not seek', concern: Concern.Clock },
  { pattern: /(^|[;{\s])transition(-[a-z-]+)?\s*:/i, message: 'transition: animate on tl, CSS transitions do not seek', concern: Concern.Clock },
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

const textProblems = (text: string, rules: TextRule[], allowed: ReadonlySet<Concern>) => rules.filter((r) => !(r.concern && allowed.has(r.concern)) && r.pattern.test(text)).map((r) => r.message);

export function lintSource(source: CustomSource, mode = ComponentMode.Deterministic): LintProblem[] {
  const allowed = ALLOWED[mode];
  return [
    ...textProblems(source.html, HTML_RULES, allowed).map((message) => ({ file: 'html' as const, message })),
    ...textProblems(source.css, CSS_RULES, allowed).map((message) => ({ file: 'css' as const, message })),
    ...lintJs(source.js, allowed).map((message) => ({ file: 'js' as const, message }))
  ];
}

type GpuFacts = { webgl: boolean; renderers: number; rawRenderers: number; pixelRatio: boolean; disposes: boolean; shadows: boolean; castingLights: number };

const MAX_SHADOW_LIGHTS = 1;

const NON_CASTING_LIGHTS = new Set(['AmbientLight', 'HemisphereLight', 'RectAreaLight', 'LightProbe']);

const GPU_LIBRARIES = new Set(['THREE', 'twgl', 'PIXI']);

const RENDERER_CALLS: Record<string, string> = { three: 'renderer', twgl: 'webgl' };

const ADVICE: { when: (f: GpuFacts) => boolean; message: string }[] = [
  { when: (f) => f.rawRenderers > 0, message: 'new THREE.WebGLRenderer: use three.renderer(canvas), tuned for preview, phones and export' },
  { when: (f) => f.renderers > 1, message: 'one renderer per component: every WebGL canvas is a context the export reads back on each frame' },
  { when: (f) => f.pixelRatio, message: 'setPixelRatio/devicePixelRatio: the host sets the pixel ratio' },
  { when: (f) => !f.disposes, message: 'no dispose: free geometries, materials, textures and the renderer in onDestroy' },
  { when: (f) => f.shadows && f.castingLights > MAX_SHADOW_LIGHTS, message: 'shadow map with several lights: cast shadows from one light only' }
];

const memberOf = (node: AnyNode, object: string, property: string) => node.type === 'MemberExpression' && name(node.object) === object && propertyName(node) === property;

function gpuFacts(program: Node): GpuFacts {
  const facts: GpuFacts = { webgl: false, renderers: 0, rawRenderers: 0, pixelRatio: false, disposes: false, shadows: false, castingLights: 0 };
  full(program, (n) => {
    const node = n as AnyNode;
    if (node.type === 'Identifier' && (GPU_LIBRARIES.has(String(node.name)) || node.name === 'devicePixelRatio')) {
      facts.webgl ||= node.name !== 'devicePixelRatio';
      facts.pixelRatio ||= node.name === 'devicePixelRatio';
    }
    if (node.type === 'MemberExpression') {
      const property = propertyName(node);
      facts.pixelRatio ||= property === 'setPixelRatio';
      facts.disposes ||= property === 'dispose';
      facts.shadows ||= property === 'shadowMap';
    }
    if (node.type === 'CallExpression' && Object.entries(RENDERER_CALLS).some(([object, property]) => memberOf(node.callee as AnyNode, object, property))) {
      facts.webgl = true;
      facts.renderers += 1;
    }
    if (node.type !== 'NewExpression') {
      return;
    }
    const callee = node.callee as AnyNode;
    const made = callee.type === 'MemberExpression' && name(callee.object) === 'THREE' ? propertyName(callee) : null;
    if (made === 'WebGLRenderer' || memberOf(callee, 'PIXI', 'Application')) {
      facts.renderers += 1;
      facts.rawRenderers += made === 'WebGLRenderer' ? 1 : 0;
    }
    if (made?.endsWith('Light') && !NON_CASTING_LIGHTS.has(made)) {
      facts.castingLights += 1;
    }
  });
  return facts;
}

export function lintAdvice(source: CustomSource): string[] {
  let program: Node;
  try {
    program = parse(source.js, { ecmaVersion: ECMA_VERSION, sourceType: 'script', allowReturnOutsideFunction: true });
  } catch {
    return [];
  }
  const facts = gpuFacts(program);
  if (!facts.webgl) {
    return [];
  }
  return ADVICE.filter((a) => a.when(facts)).map((a) => a.message);
}

export function lintReport(problems: LintProblem[]): string {
  return problems.map((p) => `${p.file}: ${p.message}`).join('\n');
}
