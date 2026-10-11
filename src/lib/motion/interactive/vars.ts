import type { ComponentId } from '../components';
import { clipsOf, findClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { setExpression } from '../expression/ops';
import { interactiveOf } from './settings';
import { BindPaint, MAX_VARS, VarKind, coerceVars, type PaintBinding, type VarBinding, type VarDecl, type VarValues } from './var-model';
import { varProblem } from './var-schema';

export * from './var-model';

type Bindable = { kind: VarKind; paint: BindPaint };

const TEXT: Bindable = { kind: VarKind.String, paint: BindPaint.Text };
const INK: Bindable = { kind: VarKind.Color, paint: BindPaint.Color };
const TYPE_LAYER = { text: TEXT, color: INK };

const BINDABLE: Partial<Record<ComponentId, Record<string, Bindable>>> = {
  Title: TYPE_LAYER,
  Text: TYPE_LAYER,
  Kicker: TYPE_LAYER,
  Caption: { ...TYPE_LAYER, background: { kind: VarKind.Color, paint: BindPaint.Background } }
};

const NUMERIC_KINDS = new Set([VarKind.Number, VarKind.Boolean, VarKind.Enum]);

const fail = (error: string): OpResult => ({ ok: false, error });

const withInteractive = (doc: MotionDoc, patch: { vars?: VarDecl[]; bindings?: VarBinding[] }): MotionDoc => ({ ...doc, interactive: { ...interactiveOf(doc), ...patch } });

export function declareVar(doc: MotionDoc, decl: VarDecl): OpResult {
  const problem = varProblem(decl);
  if (problem) {
    return fail(problem);
  }
  const { vars } = interactiveOf(doc);
  const others = vars.filter((v) => v.name !== decl.name);
  if (others.length >= MAX_VARS) {
    return fail(`at most ${MAX_VARS} variables`);
  }
  const at = vars.findIndex((v) => v.name === decl.name);
  const next = at < 0 ? [...vars, decl] : vars.map((v, i) => (i === at ? decl : v));
  const kept = interactiveOf(doc).bindings.filter((b) => b.var !== decl.name || bindableOf(doc, b)?.kind === decl.kind);
  return { ok: true, doc: withInteractive(doc, { vars: next, bindings: kept }) };
}

export function removeVar(doc: MotionDoc, name: string): OpResult {
  const { vars, bindings } = interactiveOf(doc);
  if (!vars.some((v) => v.name === name)) {
    return fail(`no variable ${name}`);
  }
  return { ok: true, doc: withInteractive(doc, { vars: vars.filter((v) => v.name !== name), bindings: bindings.filter((b) => b.var !== name) }) };
}

function bindableOf(doc: MotionDoc, binding: VarBinding): Bindable | undefined {
  const clip = findClip(doc, binding.clip)?.clip;
  return clip ? BINDABLE[clip.component]?.[binding.prop] : undefined;
}

const STARTER: Record<VarKind, (name: string) => VarDecl> = {
  [VarKind.Number]: (name) => ({ name, kind: VarKind.Number, default: 1, min: 0, max: 2 }),
  [VarKind.Boolean]: (name) => ({ name, kind: VarKind.Boolean, default: false }),
  [VarKind.Enum]: (name) => ({ name, kind: VarKind.Enum, default: 'a', options: ['a', 'b'] }),
  [VarKind.Color]: (name) => ({ name, kind: VarKind.Color, default: '#ffffff' }),
  [VarKind.String]: (name) => ({ name, kind: VarKind.String, default: 'Text' })
};

export function starterVar(kind: VarKind, name: string): VarDecl {
  return STARTER[kind](name);
}

const NUMBER_PROPS = ['x', 'y', 'scale', 'rotateZ', 'opacity'];

export function bindTargets(component: ComponentId, kind: VarKind): string[] {
  if (NUMERIC_KINDS.has(kind)) {
    return NUMBER_PROPS;
  }
  return Object.entries(BINDABLE[component] ?? {}).filter(([, b]) => b.kind === kind).map(([prop]) => prop);
}

export function bindVar(doc: MotionDoc, binding: VarBinding): OpResult {
  const decl = interactiveOf(doc).vars.find((v) => v.name === binding.var);
  if (!decl) {
    return fail(`no variable ${binding.var}: declare it first`);
  }
  const clip = findClip(doc, binding.clip)?.clip;
  if (!clip) {
    return fail(`no clip ${binding.clip}`);
  }
  if (NUMERIC_KINDS.has(decl.kind)) {
    return setExpression(doc, binding.clip, binding.prop, `vars.${decl.name}`);
  }

  const target = bindableOf(doc, binding);
  if (target?.kind !== decl.kind) {
    const fits = Object.entries(BINDABLE[clip.component] ?? {}).filter(([, b]) => b.kind === decl.kind).map(([prop]) => prop);
    return fail(`${clip.component} ${binding.prop} cannot show a ${decl.kind} variable${fits.length ? `; it can bind ${fits.join(', ')}` : ''}. A ${decl.kind} variable binds to the text or colour of a Title, Text, Kicker or Caption`);
  }
  const bindings = interactiveOf(doc).bindings.filter((b) => !(b.clip === binding.clip && b.prop === binding.prop));
  return { ok: true, doc: withInteractive(doc, { bindings: [...bindings, binding] }) };
}

export function unbindVar(doc: MotionDoc, clip: string, prop: string): OpResult {
  const { bindings } = interactiveOf(doc);
  if (bindings.some((b) => b.clip === clip && b.prop === prop)) {
    return { ok: true, doc: withInteractive(doc, { bindings: bindings.filter((b) => !(b.clip === clip && b.prop === prop)) }) };
  }
  return setExpression(doc, clip, prop, null);
}

export function withVars(doc: MotionDoc, values: unknown): MotionDoc {
  const { vars } = interactiveOf(doc);
  const given = coerceVars(vars, values);
  if (!vars.length || !Object.keys(given).length) {
    return doc;
  }
  return withInteractive(doc, { vars: vars.map((v) => (v.name in given ? ({ ...v, default: given[v.name] } as VarDecl) : v)) });
}

export function boundDoc(doc: MotionDoc): MotionDoc {
  const { vars, bindings } = interactiveOf(doc);
  if (!bindings.length) {
    return doc;
  }
  const values: VarValues = Object.fromEntries(vars.map((v) => [v.name, v.default]));
  const patches = new Map<string, Record<string, unknown>>();
  for (const b of bindings) {
    if (b.var in values) {
      patches.set(b.clip, { ...patches.get(b.clip), [b.prop]: values[b.var] });
    }
  }
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (patches.has(c.id) ? { ...c, props: { ...c.props, ...patches.get(c.id) } } : c)) })) };
}

export function paintBindings(doc: MotionDoc): PaintBinding[] {
  const ids = new Set(clipsOf(doc).map((c) => c.id));
  return interactiveOf(doc).bindings.flatMap((b) => {
    const target = bindableOf(doc, b);
    return target && ids.has(b.clip) ? [{ var: b.var, selector: `[data-clip="${b.clip}"] [data-fit]`, paint: target.paint }] : [];
  });
}
