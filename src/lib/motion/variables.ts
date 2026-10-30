import { Control } from '@feega/motion-core/motion/components';
import { fieldsOf } from './inspector';
import { fillReplaces } from '@feega/motion-core/motion/fill/elements';
import { findClip, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { mapEveryTrack } from './doc-scopes';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { DEFAULT_MODE, VarType, keyOf, splitKey, variableSchema, variablesSchema, type Collection, type VarAlias, type VarInput, type VarLiteral, type Variables } from '@feega/motion-core/motion/variables-model';

export { VarType };

export enum VariableAction {
  Define = 'define',
  Mode = 'mode',
  AddMode = 'add_mode',
  Bind = 'bind',
  Unbind = 'unbind',
  Remove = 'remove',
  List = 'list'
}

const GAP_TARGETS = ['autoLayout.gap', 'autoLayout.crossGap'];
const PADDING_TARGET = 'autoLayout.padding';
const PADDING_SIDES = ['top', 'right', 'bottom', 'left'] as const;
const LAYOUT_PREFIX = 'autoLayout.';

const CONTROL_TYPE: Partial<Record<Control, VarType>> = {
  [Control.Color]: VarType.Colour,
  [Control.Range]: VarType.Number,
  [Control.Text]: VarType.String,
  [Control.Textarea]: VarType.String,
  [Control.Toggle]: VarType.Boolean
};

const isAlias = (value: unknown): value is VarAlias => typeof value === 'object' && value !== null;

function typeOfTarget(clip: MotionClip, target: string): VarType | undefined {
  if (target === PADDING_TARGET || GAP_TARGETS.includes(target)) {
    return clip.autoLayout ? VarType.Number : undefined;
  }
  const field = fieldsOf(clip.component).find((f) => f.key === target);
  return field ? CONTROL_TYPE[field.control] : undefined;
}

export function bindableTargets(clip: MotionClip, type: VarType): string[] {
  const own = fieldsOf(clip.component).filter((f) => CONTROL_TYPE[f.control] === type).map((f) => f.key);
  const layout = type === VarType.Number && clip.autoLayout ? [...GAP_TARGETS, PADDING_TARGET] : [];
  return [...own, ...layout];
}

function activeMode(collection: Collection): string {
  return collection.active && collection.modes.includes(collection.active) ? collection.active : collection.modes[0];
}

function valueOf(variables: Variables, key: string, seen: readonly string[] = []): VarLiteral | undefined {
  const at = splitKey(key);
  const collection = at ? variables[at[0]] : undefined;
  const variable = at ? collection?.vars[at[1]] : undefined;
  if (!collection || !variable || seen.includes(key)) {
    return undefined;
  }
  const raw = variable.values[activeMode(collection)];
  return isAlias(raw) ? valueOf(variables, raw.alias, [...seen, key]) : raw;
}

function typeOfKey(variables: Variables | undefined, key: string): VarType | undefined {
  const at = splitKey(key);
  return at ? variables?.[at[0]]?.vars[at[1]]?.type : undefined;
}

const LITERAL_OF: Record<VarType, string> = { [VarType.Colour]: 'string', [VarType.Number]: 'number', [VarType.String]: 'string', [VarType.Boolean]: 'boolean' };

function valueProblem(variables: Variables, key: string, type: VarType, raw: VarLiteral | VarAlias): string | null {
  if (!isAlias(raw)) {
    return typeof raw === LITERAL_OF[type] ? null : `${key}: expected a ${type}`;
  }
  if (typeOfKey(variables, raw.alias) !== type) {
    return `${key}: ${raw.alias} is not a ${type} variable`;
  }
  return valueOf(variables, raw.alias, [key]) === undefined ? `${key}: alias to ${raw.alias} loops` : null;
}

function modesProblem(collection: Collection, key: string, values: Record<string, unknown>): string | null {
  const missing = collection.modes.find((m) => !(m in values));
  const stray = Object.keys(values).find((m) => !collection.modes.includes(m));
  return missing ? `${key}: no value for mode ${missing}` : stray ? `${key}: ${stray} is not a mode` : null;
}

function problemOf(variables: Variables): string | null {
  for (const [collectionName, collection] of Object.entries(variables)) {
    for (const [name, variable] of Object.entries(collection.vars)) {
      const key = keyOf(collectionName, name);
      const found = modesProblem(collection, key, variable.values) ?? Object.values(variable.values).map((raw) => valueProblem(variables, key, variable.type, raw)).find(Boolean);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function withVariables(doc: MotionDoc, variables: Variables): OpResult {
  const checked = variablesSchema.safeParse(variables);
  if (!checked.success) {
    return { ok: false, error: checked.error.issues[0].message };
  }
  const problem = problemOf(variables);
  return problem ? { ok: false, error: problem } : { ok: true, doc: resolveVariables({ ...doc, variables }) };
}

function withLayout(clip: MotionClip, target: string, value: VarLiteral): MotionClip {
  if (!clip.autoLayout || typeof value !== 'number') {
    return clip;
  }
  if (target === PADDING_TARGET) {
    const padding = Object.fromEntries(PADDING_SIDES.map((side) => [side, value])) as typeof clip.autoLayout.padding;
    return { ...clip, autoLayout: { ...clip.autoLayout, padding } };
  }
  return { ...clip, autoLayout: { ...clip.autoLayout, [target.slice(LAYOUT_PREFIX.length)]: value } };
}

function clamped(clip: MotionClip, target: string, value: VarLiteral): VarLiteral {
  const field = fieldsOf(clip.component).find((f) => f.key === target);
  return typeof value === 'number' && field ? Math.min(field.max ?? value, Math.max(field.min ?? value, value)) : value;
}

function ownedFill(clip: MotionClip, target: string): MotionClip['props'] {
  if (!fillReplaces(clip.component, target)) {
    return clip.props;
  }
  const { fills: _stack, ...rest } = clip.props;
  return rest;
}

export const fillTarget = (clip: MotionClip): string | undefined => bindableTargets(clip, VarType.Colour).find((t) => fillReplaces(clip.component, t));

function resolvedClip(variables: Variables, clip: MotionClip): MotionClip {
  let next = clip;
  for (const [target, key] of Object.entries(clip.bind ?? {})) {
    const value = valueOf(variables, key);
    if (value === undefined) {
      continue;
    }
    next = target.startsWith(LAYOUT_PREFIX) ? withLayout(next, target, value) : { ...next, props: { ...ownedFill(next, target), [target]: clamped(next, target, value) } };
  }
  return next;
}

export function resolveVariables(doc: MotionDoc): MotionDoc {
  const variables = doc.variables;
  if (!variables) {
    return doc;
  }
  return mapEveryTrack(doc, (tracks) => tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.bind ? resolvedClip(variables, c as MotionClip) : c)) })));
}

export function defineVariable(doc: MotionDoc, collection: string, name: string, input: VarInput, modes?: readonly string[]): OpResult {
  const parsed = variableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const existing = doc.variables?.[collection];
  const next: Collection = { ...existing, modes: [...(modes ?? existing?.modes ?? [DEFAULT_MODE])], vars: { ...existing?.vars, [name]: parsed.data } };
  return withVariables(doc, { ...doc.variables, [collection]: next });
}

export function setActiveMode(doc: MotionDoc, collection: string, mode: string): OpResult {
  const existing = doc.variables?.[collection];
  if (!existing) {
    return { ok: false, error: `no collection ${collection}` };
  }
  if (!existing.modes.includes(mode)) {
    return { ok: false, error: `${collection} has modes ${existing.modes.join(', ')}` };
  }
  return withVariables(doc, { ...doc.variables, [collection]: { ...existing, active: mode } });
}

type Bind = Record<string, string>;

function rebound(doc: MotionDoc, change: (clip: MotionClip) => Bind): MotionDoc {
  return mapEveryTrack(doc, (tracks) => reboundTracks(tracks, change));
}

function reboundTracks(tracks: MotionTrack[], change: (clip: MotionClip) => Bind): MotionTrack[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const bind = change(c as MotionClip);
      const { bind: _old, ...rest } = c;
      return Object.keys(bind).length ? { ...rest, bind } : rest;
    })
  })) as MotionTrack[];
}

const withTarget = (doc: MotionDoc, clipId: string, edit: (bind: Bind) => Bind) => rebound(doc, (c) => (c.id === clipId ? edit(c.bind ?? {}) : (c.bind ?? {})));

export function bindVariable(doc: MotionDoc, clipId: string, target: string, key: string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const type = typeOfKey(doc.variables, key);
  if (!type) {
    return { ok: false, error: `no variable ${key}` };
  }
  if (typeOfTarget(clip, target) !== type) {
    return { ok: false, error: `${target} does not take a ${type} variable: ${bindableTargets(clip, type).join(', ') || 'this clip has no such target'}` };
  }
  return { ok: true, doc: resolveVariables(withTarget(doc, clipId, (bind) => ({ ...bind, [target]: key }))) };
}

export function unbindVariable(doc: MotionDoc, clipId: string, target: string): OpResult {
  if (!findClip(doc, clipId)) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  return { ok: true, doc: withTarget(doc, clipId, ({ [target]: _gone, ...rest }) => rest) };
}

function aliasing(variables: Variables, key: string): string[] {
  return Object.entries(variables).flatMap(([c, col]) =>
    Object.entries(col.vars)
      .filter(([, v]) => Object.values(v.values).some((x) => isAlias(x) && x.alias === key))
      .map(([n]) => keyOf(c, n))
  );
}

export function removeVariable(doc: MotionDoc, collection: string, name: string): OpResult {
  const existing = doc.variables?.[collection];
  const key = keyOf(collection, name);
  if (!existing?.vars[name] || !doc.variables) {
    return { ok: false, error: `no variable ${key}` };
  }
  const users = aliasing(doc.variables, key);
  if (users.length) {
    return { ok: false, error: `${users.join(', ')} alias ${key}` };
  }
  const { [name]: _gone, ...vars } = existing.vars;
  const freed = rebound(doc, (c) => Object.fromEntries(Object.entries(c.bind ?? {}).filter(([, k]) => k !== key)));
  return { ok: true, doc: { ...freed, variables: { ...doc.variables, [collection]: { ...existing, vars } } } };
}

export function addMode(doc: MotionDoc, collection: string, mode: string): OpResult {
  const existing = doc.variables?.[collection];
  if (!existing) {
    return { ok: false, error: `no collection ${collection}` };
  }
  if (existing.modes.includes(mode)) {
    return { ok: false, error: `${collection} already has the mode ${mode}` };
  }
  const first = existing.modes[0];
  const vars = Object.fromEntries(Object.entries(existing.vars).map(([name, v]) => [name, { ...v, values: { ...v.values, [mode]: v.values[first] } }]));
  return withVariables(doc, { ...doc.variables, [collection]: { ...existing, modes: [...existing.modes, mode], vars } });
}

export type VariableEntry = { key: string; type: VarType };

export function variableEntries(variables: Variables | undefined): VariableEntry[] {
  return Object.entries(variables ?? {}).flatMap(([collection, c]) => Object.entries(c.vars).map(([name, v]) => ({ key: keyOf(collection, name), type: v.type })));
}

export type BindChip = { type: VarType; bound: string | null; options: VariableEntry[] };

export function bindChip(clip: MotionClip, target: string, variables: Variables | undefined): BindChip | null {
  const type = typeOfTarget(clip, target);
  if (!type) {
    return null;
  }
  const bound = clip.bind?.[target] ?? null;
  const options = variableEntries(variables).filter((e) => e.type === type);
  return bound || options.length ? { type, bound, options } : null;
}

export const variableValue = (variables: Variables | undefined, key: string) => (variables ? valueOf(variables, key) : undefined);

export const typeOfVariable = (variables: Variables | undefined, key: string) => typeOfKey(variables, key);

export function activeModeOf(doc: MotionDoc, collection: string): string {
  const existing = doc.variables?.[collection];
  return existing ? activeMode(existing) : '';
}

export function setCollection(doc: MotionDoc, name: string, collection: Collection): OpResult {
  return withVariables(doc, { ...doc.variables, [name]: collection });
}
