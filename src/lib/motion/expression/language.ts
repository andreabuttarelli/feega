import { sampleTrack } from '../sample-track';
import type { Keyframe } from '../keyframes';
import { INPUT_KEYS, type InputPort } from './inputs';

export const MAX_SOURCE = 2000;
export const MAX_STEPS = 4000;
const MAX_DEPTH = 64;

export type LayerHandle = { get: (key: string) => number };

export type AudioPort = { amp: (ref: string | number | null, smoothing: number) => number; beat: (ref: string | number | null) => number; onset: (ref: string | number | null) => number };

export const SILENT_AUDIO: AudioPort = { amp: () => 0, beat: () => 0, onset: () => 0 };

export type Scope = {
  time: number;
  frame: number;
  fps: number;
  value: number;
  index: number;
  seed: number;
  track: readonly Keyframe[];
  thisLayer: LayerHandle;
  layer: (ref: string | number) => LayerHandle;
  audio: AudioPort;
  input: InputPort;
};

export class ExpressionError extends Error {}

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; name: string }
  | { kind: 'array'; items: Node[] }
  | { kind: 'member'; object: Node; key: Node }
  | { kind: 'call'; callee: Node; args: Node[] }
  | { kind: 'unary'; op: string; arg: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'cond'; test: Node; yes: Node; no: Node };

type Statement = { name: string | null; expr: Node };

export type Program = readonly Statement[];

export type Compiled = { ok: true; program: Program } | { ok: false; error: string };

type Token = { kind: 'num' | 'str' | 'name' | 'punct' | 'end'; text: string };

const PUNCTS = ['===', '!==', '**', '==', '!=', '<=', '>=', '&&', '||', '(', ')', '[', ']', ',', '.', '?', ':', ';', '+', '-', '*', '/', '%', '<', '>', '!', '=', '\n'];
const DECLARATIONS = new Set(['const', 'let', 'var']);
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
const NAME = /^[A-Za-z_$][\w$]*/;
const STRING = /^(?:"[^"\\\n]*"|'[^'\\\n]*')/;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let rest = source;
  while (rest.length) {
    const space = /^[ \t\r]+|^\/\/[^\n]*/.exec(rest);
    if (space) {
      rest = rest.slice(space[0].length);
      continue;
    }
    const num = NUMBER.exec(rest);
    const name = num ? null : NAME.exec(rest);
    const str = num || name ? null : STRING.exec(rest);
    const punct = num || name || str ? undefined : PUNCTS.find((p) => rest.startsWith(p));
    const text = num?.[0] ?? name?.[0] ?? str?.[0] ?? punct;
    if (!text) {
      throw new ExpressionError(`unexpected "${rest[0]}"`);
    }
    tokens.push({ kind: num ? 'num' : name ? 'name' : str ? 'str' : 'punct', text });
    rest = rest.slice(text.length);
  }
  return [...tokens, { kind: 'end', text: '' }];
}

const BINARY: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '===': 3,
  '!==': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  '**': 7
};

const RIGHT_ASSOCIATIVE = new Set(['**']);

class Parser {
  private at = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  program(): Program {
    const statements: Statement[] = [];
    this.skipBreaks();
    while (this.peek().kind !== 'end') {
      statements.push(this.statement());
      if (this.peek().kind !== 'end' && !this.isBreak()) {
        throw new ExpressionError(`unexpected "${this.peek().text}"`);
      }
      this.skipBreaks();
    }
    if (!statements.length || statements[statements.length - 1].name !== null) {
      throw new ExpressionError('the expression must end with a value');
    }
    return statements;
  }

  private statement(): Statement {
    if (!DECLARATIONS.has(this.peek().text)) {
      return { name: null, expr: this.expression() };
    }
    this.next();
    const name = this.next();
    if (name.kind !== 'name') {
      throw new ExpressionError('a declaration needs a name');
    }
    this.expect('=');
    return { name: name.text, expr: this.expression() };
  }

  private expression(): Node {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) {
      throw new ExpressionError('the expression is nested too deep');
    }
    const test = this.binary(1);
    const node = this.eat('?') ? this.conditional(test) : test;
    this.depth -= 1;
    return node;
  }

  private conditional(test: Node): Node {
    const yes = this.expression();
    this.expect(':');
    return { kind: 'cond', test, yes, no: this.expression() };
  }

  private binary(min: number): Node {
    let left = this.unary();
    for (;;) {
      const op = this.peek().text;
      const precedence = this.peek().kind === 'punct' ? BINARY[op] : undefined;
      if (precedence === undefined || precedence < min) {
        return left;
      }
      this.next();
      const right = this.binary(RIGHT_ASSOCIATIVE.has(op) ? precedence : precedence + 1);
      left = { kind: 'binary', op, left, right };
    }
  }

  private unary(): Node {
    const op = this.peek().text;
    if (this.peek().kind === 'punct' && (op === '-' || op === '+' || op === '!')) {
      this.next();
      this.depth += 1;
      if (this.depth > MAX_DEPTH) {
        throw new ExpressionError('the expression is nested too deep');
      }
      const node: Node = { kind: 'unary', op, arg: this.unary() };
      this.depth -= 1;
      return node;
    }
    return this.postfix(this.primary());
  }

  private postfix(node: Node): Node {
    for (;;) {
      if (this.eat('.')) {
        const key = this.next();
        if (key.kind !== 'name') {
          throw new ExpressionError('expected a property name after "."');
        }
        node = { kind: 'member', object: node, key: { kind: 'str', value: key.text } };
      } else if (this.eat('[')) {
        const key = this.expression();
        this.expect(']');
        node = { kind: 'member', object: node, key };
      } else if (this.eat('(')) {
        node = { kind: 'call', callee: node, args: this.list(')') };
      } else {
        return node;
      }
    }
  }

  private primary(): Node {
    const token = this.next();
    if (token.kind === 'num') {
      return { kind: 'num', value: Number(token.text) };
    }
    if (token.kind === 'str') {
      return { kind: 'str', value: token.text.slice(1, -1) };
    }
    if (token.kind === 'name') {
      return { kind: 'name', name: token.text };
    }
    if (token.text === '(') {
      const node = this.expression();
      this.expect(')');
      return node;
    }
    if (token.text === '[') {
      return { kind: 'array', items: this.list(']') };
    }
    throw new ExpressionError(token.kind === 'end' ? 'the expression ends too early' : `unexpected "${token.text}"`);
  }

  private list(close: string): Node[] {
    const items: Node[] = [];
    if (this.eat(close)) {
      return items;
    }
    do {
      items.push(this.expression());
    } while (this.eat(','));
    this.expect(close);
    return items;
  }

  private skipBreaks() {
    while (this.isBreak()) {
      this.next();
    }
  }

  private isBreak(): boolean {
    return this.peek().text === ';' || this.peek().text === '\n';
  }

  private peek(): Token {
    while (this.tokens[this.at].text === '\n' && this.continues()) {
      this.at += 1;
    }
    return this.tokens[this.at];
  }

  private continues(): boolean {
    const before = this.tokens[this.at - 1];
    const after = this.tokens[this.at + 1];
    const open = before && before.kind === 'punct' && before.text !== ')' && before.text !== ']' && before.text !== '\n';
    const leading = after && after.kind === 'punct' && ['.', '?', ':', ')', ']', ',', '*', '/', '%', '**', '&&', '||', '==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(after.text);
    return Boolean(open || leading || !before);
  }

  private next(): Token {
    const token = this.peek();
    this.at = Math.min(this.at + 1, this.tokens.length - 1);
    return token;
  }

  private eat(text: string): boolean {
    if (this.peek().kind !== 'punct' || this.peek().text !== text) {
      return false;
    }
    this.next();
    return true;
  }

  private expect(text: string) {
    if (!this.eat(text)) {
      throw new ExpressionError(`expected "${text}"`);
    }
  }
}

export function compileExpression(source: string): Compiled {
  if (source.length > MAX_SOURCE) {
    return { ok: false, error: `the expression is too long (max ${MAX_SOURCE} characters)` };
  }
  try {
    return { ok: true, program: new Parser(tokenize(source)).program() };
  } catch (e) {
    return { ok: false, error: e instanceof ExpressionError ? e.message : 'the expression cannot be read' };
  }
}

type Fn = (...args: Value[]) => Value;

class Builtin {
  constructor(
    readonly name: string,
    readonly call: Fn
  ) {}
}

class Namespace {
  constructor(readonly members: ReadonlyMap<string, Value>) {}
}

class Handle {
  constructor(readonly layer: LayerHandle) {}
}

type Value = number | string | boolean | Value[] | Builtin | Namespace | Handle;

const num = (v: Value, what: string): number => {
  if (typeof v !== 'number') {
    throw new ExpressionError(`${what} expects a number`);
  }
  return v;
};

function hash(seed: number, n: number): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(n | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function seedOfNumber(seed: number): number {
  return Math.round(seed * 1000) | 0;
}

function noise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const smooth = f * f * (3 - 2 * f);
  const a = hash(seed, i) * 2 - 1;
  const b = hash(seed, i + 1) * 2 - 1;
  return a + (b - a) * smooth;
}

const OCTAVE_DECAY = 0.5;
const MAX_OCTAVES = 8;
const WIGGLE_COST = MAX_OCTAVES * 8;

function wiggle(scope: Scope, freq: number, amp: number, octaves: number, seed: number): number {
  let total = 0;
  let amplitude = 1;
  let frequency = freq;
  const count = Math.max(1, Math.min(MAX_OCTAVES, Math.round(octaves)));
  for (let o = 0; o < count; o++) {
    total += noise(seed * 31 + o, scope.time * frequency) * amplitude;
    amplitude *= OCTAVE_DECAY;
    frequency *= 2;
  }
  return scope.value + total * amp;
}

type Curve = (p: number) => number;

const CURVES: Record<'linear' | 'ease' | 'easeIn' | 'easeOut', Curve> = {
  linear: (p) => p,
  ease: (p) => p * p * (3 - 2 * p),
  easeIn: (p) => p * p * p,
  easeOut: (p) => 1 - (1 - p) ** 3
};

function interpolate(curve: Curve, args: number[]): number {
  const [t, tMin, tMax, v1, v2] = args.length === 3 ? [args[0], 0, 1, args[1], args[2]] : args;
  if (args.length !== 3 && args.length !== 5) {
    throw new ExpressionError('interpolation takes (t, v1, v2) or (t, tMin, tMax, v1, v2)');
  }
  const span = tMax - tMin;
  const p = span === 0 ? 1 : Math.min(1, Math.max(0, (t - tMin) / span));
  return v1 + (v2 - v1) * curve(p);
}

enum LoopType {
  Cycle = 'cycle',
  PingPong = 'pingpong',
  Offset = 'offset',
  Continue = 'continue'
}

const LOOP_TYPES = new Set<string>(Object.values(LoopType));

type Loop = { track: readonly Keyframe[]; frame: number; first: number; last: number };

const at = (track: readonly Keyframe[], frame: number) => sampleTrack(track as Keyframe[], frame);

const LOOPS: Record<LoopType, (loop: Loop, direction: 1 | -1) => number> = {
  [LoopType.Cycle]: ({ track, frame, first, last }) => at(track, first + mod(frame - first, last - first)),
  [LoopType.PingPong]: ({ track, frame, first, last }) => {
    const span = last - first;
    const phase = mod(frame - first, 2 * span);
    return at(track, first + (phase <= span ? phase : 2 * span - phase));
  },
  [LoopType.Offset]: ({ track, frame, first, last }) => {
    const span = last - first;
    const cycles = Math.floor((frame - first) / span);
    return at(track, first + mod(frame - first, span)) + (at(track, last) - at(track, first)) * cycles;
  },
  [LoopType.Continue]: ({ track, frame, first, last }, direction) => {
    const edge = direction > 0 ? last : first;
    const step = direction > 0 ? -1 : 1;
    const slope = (at(track, edge) - at(track, edge + step)) * -step;
    return at(track, edge) + slope * (frame - edge);
  }
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function loop(scope: Scope, type: Value | undefined, direction: 1 | -1): number {
  const kind = type === undefined ? LoopType.Cycle : String(type);
  if (!LOOP_TYPES.has(kind)) {
    throw new ExpressionError(`loop type must be one of ${[...LOOP_TYPES].join(', ')}`);
  }
  const { track } = scope;
  if (track.length < 2) {
    return scope.value;
  }
  const first = track[0].frame;
  const last = track[track.length - 1].frame;
  const outside = direction > 0 ? scope.frame > last : scope.frame < first;
  if (!outside || last === first) {
    return scope.value;
  }
  return LOOPS[kind as LoopType]({ track, frame: scope.frame, first, last }, direction);
}

const MATH_FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'abs', 'floor', 'ceil', 'round', 'min', 'max', 'pow', 'sqrt', 'exp', 'log', 'sign', 'hypot', 'trunc'] as const;

const MATH = new Namespace(
  new Map<string, Value>([
    ...MATH_FUNCTIONS.map((name): [string, Value] => [name, new Builtin(`Math.${name}`, (...args) => (Math[name] as (...n: number[]) => number)(...args.map((a) => num(a, `Math.${name}`))))]),
    ['PI', Math.PI],
    ['E', Math.E]
  ])
);

const DEFAULT_SMOOTHING = 1;

function audioRef(name: string, ref: Value | undefined): string | number | null {
  if (ref === undefined) {
    return null;
  }
  if (typeof ref !== 'string' && typeof ref !== 'number') {
    throw new ExpressionError(`${name}() takes a clip or track name, id or index`);
  }
  return ref;
}

function audioNamespace(port: AudioPort): Namespace {
  return new Namespace(
    new Map<string, Value>([
      ['amp', new Builtin('audio.amp', (ref, smoothing) => port.amp(audioRef('audio.amp', ref), smoothing === undefined ? DEFAULT_SMOOTHING : num(smoothing, 'audio.amp')))],
      ['beat', new Builtin('audio.beat', (ref) => port.beat(audioRef('audio.beat', ref)))],
      ['onset', new Builtin('audio.onset', (ref) => port.onset(audioRef('audio.onset', ref)))]
    ])
  );
}

function inputNamespace(port: InputPort): Namespace {
  const groups = new Map<string, Map<string, Value>>();
  const top = new Map<string, Value>();
  for (const key of INPUT_KEYS) {
    const [group, name] = key.split('.');
    if (name === undefined) {
      top.set(group, port.read(key));
      continue;
    }
    groups.set(group, (groups.get(group) ?? new Map()).set(name, port.read(key)));
  }
  let slot = 0;
  const smooth = new Builtin('input.smooth', (v, seconds) => port.smooth(slot++, num(v, 'input.smooth'), seconds === undefined ? 0 : num(seconds, 'input.smooth')));
  return new Namespace(new Map<string, Value>([...top, ...[...groups].map(([g, members]): [string, Value] => [g, new Namespace(members)]), ['smooth', smooth]]));
}

function globals(scope: Scope): Map<string, Value> {
  const fn = (name: string, call: Fn): [string, Value] => [name, new Builtin(name, call)];
  const numbers = (name: string, args: Value[]) => args.map((a) => num(a, name));
  return new Map<string, Value>([
    ['time', scope.time],
    ['frame', scope.frame],
    ['value', scope.value],
    ['index', scope.index],
    ['thisLayer', new Handle(scope.thisLayer)],
    ['Math', MATH],
    ['audio', audioNamespace(scope.audio)],
    ['input', inputNamespace(scope.input)],
    fn('layer', (ref) => {
      if (typeof ref !== 'string' && typeof ref !== 'number') {
        throw new ExpressionError('layer() takes a layer name, id or index');
      }
      return new Handle(scope.layer(ref));
    }),
    fn('wiggle', (...args) => {
      const [freq, amp, octaves = 1, seed] = numbers('wiggle', args);
      return wiggle(scope, freq, amp, octaves, seed === undefined ? scope.seed : seedOfNumber(seed));
    }),
    fn('random', (...args) => {
      const [seed, a, b] = numbers('random', args);
      const r = hash(seedOfNumber(seed ?? 0), 0x5eed);
      if (a === undefined) {
        return r;
      }
      return b === undefined ? r * a : a + r * (b - a);
    }),
    fn('clamp', (...args) => {
      const [v, lo, hi] = numbers('clamp', args);
      return Math.min(Math.max(v, lo), hi);
    }),
    fn('degreesToRadians', (d) => (num(d, 'degreesToRadians') * Math.PI) / 180),
    fn('radiansToDegrees', (r) => (num(r, 'radiansToDegrees') * 180) / Math.PI),
    fn('loopOut', (type) => loop(scope, type, 1)),
    fn('loopIn', (type) => loop(scope, type, -1)),
    ...(Object.keys(CURVES) as (keyof typeof CURVES)[]).map((name) => fn(name, (...args) => interpolate(CURVES[name], numbers(name, args))))
  ]);
}

const FORBIDDEN = new Set(['constructor', '__proto__', 'prototype', '__defineGetter__', '__lookupGetter__']);

function member(object: Value, key: Value): Value {
  const name = String(key);
  if (FORBIDDEN.has(name)) {
    throw new ExpressionError(`"${name}" is not available`);
  }
  if (object instanceof Handle) {
    return object.layer.get(name);
  }
  if (object instanceof Namespace) {
    const found = object.members.get(name);
    if (found === undefined) {
      throw new ExpressionError(`unknown member "${name}"`);
    }
    return found;
  }
  if (Array.isArray(object)) {
    if (name === 'length') {
      return object.length;
    }
    const index = typeof key === 'number' ? key : NaN;
    if (!Number.isInteger(index) || index < 0 || index >= object.length) {
      throw new ExpressionError(`index ${name} is outside the list`);
    }
    return object[index];
  }
  throw new ExpressionError(`cannot read "${name}" of a ${typeof object}`);
}

const truthy = (v: Value) => Boolean(v);

const BINARY_OPS: Record<string, (a: Value, b: Value) => Value> = {
  '+': (a, b) => num(a, '+') + num(b, '+'),
  '-': (a, b) => num(a, '-') - num(b, '-'),
  '*': (a, b) => num(a, '*') * num(b, '*'),
  '/': (a, b) => num(a, '/') / num(b, '/'),
  '%': (a, b) => num(a, '%') % num(b, '%'),
  '**': (a, b) => num(a, '**') ** num(b, '**'),
  '<': (a, b) => num(a, '<') < num(b, '<'),
  '>': (a, b) => num(a, '>') > num(b, '>'),
  '<=': (a, b) => num(a, '<=') <= num(b, '<='),
  '>=': (a, b) => num(a, '>=') >= num(b, '>='),
  '==': (a, b) => a === b,
  '===': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '!==': (a, b) => a !== b
};

const UNARY_OPS: Record<string, (a: Value) => Value> = {
  '-': (a) => -num(a, '-'),
  '+': (a) => num(a, '+'),
  '!': (a) => !truthy(a)
};

class Machine {
  private steps = 0;

  constructor(private readonly names: Map<string, Value>) {}

  run(program: Program): Value {
    let last: Value = 0;
    for (const statement of program) {
      last = this.eval(statement.expr);
      if (statement.name !== null) {
        this.names.set(statement.name, last);
      }
    }
    return last;
  }

  private tick() {
    this.steps += 1;
    if (this.steps > MAX_STEPS) {
      throw new ExpressionError('the expression does too much work per frame');
    }
  }

  private eval(node: Node): Value {
    this.tick();
    switch (node.kind) {
      case 'num':
      case 'str':
        return node.value;
      case 'name': {
        const found = this.names.get(node.name);
        if (found === undefined) {
          throw new ExpressionError(`unknown name "${node.name}"`);
        }
        return found;
      }
      case 'array':
        return node.items.map((item) => this.eval(item));
      case 'member':
        return member(this.eval(node.object), this.eval(node.key));
      case 'call': {
        const callee = this.eval(node.callee);
        if (!(callee instanceof Builtin)) {
          throw new ExpressionError('that is not a function');
        }
        const args = node.args.map((a) => this.eval(a));
        this.steps += callee.name === 'wiggle' ? WIGGLE_COST : 1;
        return callee.call(...args);
      }
      case 'unary':
        return UNARY_OPS[node.op](this.eval(node.arg));
      case 'binary':
        return this.binary(node.op, node.left, node.right);
      case 'cond':
        return truthy(this.eval(node.test)) ? this.eval(node.yes) : this.eval(node.no);
    }
  }

  private binary(op: string, left: Node, right: Node): Value {
    if (op === '&&') {
      const a = this.eval(left);
      return truthy(a) ? this.eval(right) : a;
    }
    if (op === '||') {
      const a = this.eval(left);
      return truthy(a) ? a : this.eval(right);
    }
    return BINARY_OPS[op](this.eval(left), this.eval(right));
  }
}

export function runExpression(program: Program, scope: Scope): number {
  const result = new Machine(globals(scope)).run(program);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new ExpressionError('the expression must give a finite number');
  }
  return result;
}
