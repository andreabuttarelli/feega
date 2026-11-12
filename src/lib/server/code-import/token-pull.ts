import type { MotionClip, MotionDoc, MotionTrack } from '@feega/motion-core/motion/doc';
import { MAX_COLLECTIONS, MAX_VARIABLES, splitKey, type Collection, type Variable, type Variables } from '@feega/motion-core/motion/variables-model';
import { mapEveryTrack } from '$lib/motion/doc-scopes';
import { resolveVariables } from '$lib/motion/variables';
import { defineStyle } from '$lib/motion/styles';
import { tokenId, type TokenEntry, type TokenMap } from './design-tokens';
import { editedModes } from './token-write';
import { LIGHT } from './css-tokens';
import { StyleField, importedValue, sameStyleValue, styleValue } from './design-styles';
import type { Style } from '@feega/motion-core/motion/styles-model';

export type TokenSide = { doc: MotionDoc; map: TokenMap };

export type PulledTokens = { doc: MotionDoc; map: TokenMap; report: string[]; conflicts: string[] };

type Pull = { local: TokenSide; upstream: TokenSide; variables: Variables; map: TokenMap; report: string[]; conflicts: string[] };

const clipsOf = (doc: MotionDoc) => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

const spotOf = (clip: MotionClip) => `${clip.source!.at}|${clip.source!.cond ?? ''}`;

const sameRaw = (a: string | undefined, b: string | undefined) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

function boundBy(doc: MotionDoc, key: string): MotionClip[] {
  return clipsOf(doc).filter((c) => Object.values(c.bind ?? {}).includes(key));
}

function usages(doc: MotionDoc, key: string): string {
  return boundBy(doc, key)
    .filter((c) => c.source)
    .map(spotOf)
    .sort()
    .join('\n');
}

function variableOf(variables: Variables | undefined, key: string): Variable | undefined {
  const at = splitKey(key);
  return at ? variables?.[at[0]]?.vars[at[1]] : undefined;
}

function setValue(variables: Variables, key: string, mode: string, value: Variable['values'][string]): void {
  const at = splitKey(key)!;
  const variable = variables[at[0]]?.vars[at[1]];
  if (variable && mode in variable.values) {
    variable.values[mode] = value;
  }
}

function sameValues(a: TokenEntry, b: TokenEntry): boolean {
  const modes = new Set([...Object.keys(a.raw), ...Object.keys(b.raw)]);
  return [...modes].every((m) => sameRaw(a.raw[m], b.raw[m]));
}

function carried(pull: Pull, name: string, from: string, to: string): void {
  const edited = editedModes(pull.local.doc.variables, pull.local.map).get(from) ?? [];
  const mine = variableOf(pull.local.doc.variables, from);
  const [was, now] = [pull.local.map[from], pull.upstream.map[to]];
  for (const mode of edited) {
    const value = mine!.values[mode];
    if (!sameRaw(was.raw[mode], now.raw[mode])) {
      pull.conflicts.push(`${name} (${mode}): changed in the code too, the code wins; the canvas value was ${typeof value === 'object' ? value.alias : String(value)}`);
      continue;
    }
    setValue(pull.variables, to, mode, value);
  }
  const revalued = Object.keys(now.raw).filter((m) => !edited.includes(m) && !sameRaw(was.raw[m], now.raw[m]));
  pull.report.push(...revalued.map((m) => `${name} (${m}): revalued in the code`));
}

function renameOf(pull: Pull, from: string, added: string[]): string | null {
  const was = pull.local.map[from];
  const used = usages(pull.local.doc, from);
  const matches = added.filter((to) => sameValues(was, pull.upstream.map[to]) && usages(pull.upstream.doc, to) === used);
  return matches.length === 1 ? matches[0] : null;
}

function kept(pull: Pull, key: string): void {
  const at = splitKey(key)!;
  const theirs = pull.local.doc.variables![at[0]];
  const variable = theirs.vars[at[1]];
  const into = pull.variables[at[0]];
  if (!into) {
    pull.variables[at[0]] = { modes: theirs.modes, ...(theirs.active ? { active: theirs.active } : {}), vars: { [at[1]]: variable } };
    return;
  }
  const first = Object.values(variable.values)[0];
  into.vars[at[1]] = { ...variable, values: Object.fromEntries(into.modes.map((m) => [m, variable.values[m] ?? first])) };
}

function rebound(doc: MotionDoc, local: MotionDoc, key: string): MotionDoc {
  const wanted = new Map<string, Record<string, string>>();
  for (const clip of boundBy(local, key).filter((c) => c.source)) {
    const targets = Object.entries(clip.bind!).filter(([, k]) => k === key);
    wanted.set(spotOf(clip), { ...wanted.get(spotOf(clip)), ...Object.fromEntries(targets) });
  }
  const bind = (c: MotionClip): MotionClip => {
    const add = c.source ? wanted.get(spotOf(c)) : undefined;
    const free = add ? Object.fromEntries(Object.entries(add).filter(([target]) => !c.bind?.[target])) : {};
    return Object.keys(free).length ? { ...c, bind: { ...c.bind, ...free } } : c;
  };
  return mapEveryTrack(doc, (tracks) => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(bind) })) as MotionTrack[]);
}

function boardsOf(doc: MotionDoc): Map<string, MotionClip> {
  const clips = doc.tracks.flatMap((t) => t.clips as MotionClip[]);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const onRoot = (c: MotionClip) => !c.parent || !byId.get(c.parent)?.parent;
  return new Map(clips.filter((c) => c.name && onRoot(c)).map((c) => [c.name!, c]));
}

function withBoardModes(doc: MotionDoc, local: MotionDoc): MotionDoc {
  const mine = boardsOf(local);
  const theirs = new Set([...boardsOf(doc).values()].map((c) => c.id));
  const moded = (c: MotionClip): MotionClip => {
    const was = theirs.has(c.id) ? mine.get(c.name!) : undefined;
    if (!was) {
      return c;
    }
    const { modes: _theirs, ...rest } = c;
    return was.modes ? { ...rest, modes: was.modes } : rest;
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(moded) })) as MotionTrack[] };
}

function canvasOnly(pull: Pull): void {
  const imported = new Set(Object.keys(pull.local.map));
  for (const [name, collection] of Object.entries(pull.local.doc.variables ?? {})) {
    const own = Object.entries(collection.vars).filter(([v]) => !imported.has(`${name}/${v}`));
    const into: Collection | undefined = pull.variables[name];
    if (!into && Object.keys(pull.variables).length >= MAX_COLLECTIONS) {
      pull.report.push(`${name}: no room for this collection after the pull, left out`);
      continue;
    }
    if (!into) {
      pull.variables[name] = structuredClone(collection);
      continue;
    }
    for (const [v, variable] of own.filter(([v]) => !into.vars[v])) {
      if (Object.keys(into.vars).length >= MAX_VARIABLES) {
        pull.report.push(`${name}/${v}: no room in the collection after the pull, left out`);
        continue;
      }
      const first = Object.values(variable.values)[0];
      into.vars[v] = { ...variable, values: Object.fromEntries(into.modes.map((m) => [m, variable.values[m] ?? first])) };
    }
    if (collection.active && into.modes.includes(collection.active)) {
      into.active = collection.active;
    }
  }
}

type Styles = Record<string, Style>;

function withField(style: Style, field: StyleField, value: unknown): Style {
  return (field === StyleField.Shadow ? { ...style, effects: value } : { ...style, [field]: value }) as Style;
}

function pulledStyles(pull: Pull): Styles {
  const styles: Styles = structuredClone(pull.upstream.doc.styles ?? {});
  const mine = pull.local.doc.styles ?? {};
  const theirs = new Map(Object.values(pull.upstream.map).map((e) => [tokenId(e), e]));
  for (const entry of Object.values(pull.local.map).filter((e) => e.style)) {
    const field = entry.field as StyleField;
    const value = styleValue(mine[entry.style!], field);
    const raw = entry.raw[LIGHT];
    if (value === undefined || raw === undefined || sameStyleValue(entry, importedValue(entry, raw), value)) {
      continue;
    }
    const now = theirs.get(tokenId(entry));
    if (!now?.style || !styles[now.style]) {
      continue;
    }
    if ((now.raw[LIGHT] ?? '').trim() !== raw.trim()) {
      pull.conflicts.push(`${entry.name}: changed in the code too, the code wins; the canvas value was ${Array.isArray(value) ? JSON.stringify(value.map((e) => e.params)) : value}`);
      continue;
    }
    styles[now.style] = withField(styles[now.style], field, value);
  }
  const imported = new Set(Object.values(pull.local.map).flatMap((e) => (e.style ? [e.style] : [])));
  for (const [name, style] of Object.entries(mine).filter(([name]) => !imported.has(name) && !styles[name])) {
    styles[name] = structuredClone(style);
  }
  return styles;
}

export function pulledTokens(local: TokenSide, upstream: TokenSide): PulledTokens {
  const pull: Pull = { local, upstream, variables: structuredClone(upstream.doc.variables ?? {}), map: structuredClone(upstream.map), report: [], conflicts: [] };
  const theirs = new Map(Object.entries(upstream.map).map(([key, e]) => [tokenId(e), key]));
  const mine = new Map(Object.entries(local.map).map(([key, e]) => [tokenId(e), key]));
  const added = [...theirs].filter(([name]) => !mine.has(name)).map(([, key]) => key);
  const renamed = new Set<string>();
  let doc = upstream.doc;

  for (const [name, from] of mine) {
    const to = theirs.get(name);
    if (to) {
      carried(pull, name, from, to);
      continue;
    }
    const rename = renameOf(pull, from, added.filter((k) => !renamed.has(k)));
    if (rename) {
      renamed.add(rename);
      pull.report.push(`${name} renamed to ${tokenId(upstream.map[rename])}`);
      carried(pull, name, from, rename);
      continue;
    }
    const users = boundBy(local.doc, from).length;
    if (!users) {
      pull.report.push(`${name}: removed`);
      continue;
    }
    kept(pull, from);
    pull.map[from] = { ...local.map[from], orphan: true };
    doc = rebound(doc, local.doc, from);
    pull.report.push(`${name}: removed in the code, kept on the canvas as an orphan: ${users} layer${users === 1 ? '' : 's'} still bound`);
  }

  pull.report.push(...added.filter((k) => !renamed.has(k)).map((k) => `${tokenId(upstream.map[k])}: added`));
  canvasOnly(pull);
  const styles = pulledStyles(pull);
  let next: MotionDoc = withBoardModes({ ...doc, variables: pull.variables, ...(Object.keys(styles).length ? { styles } : {}) }, local.doc);
  for (const [name, style] of Object.entries(styles).filter(([name, style]) => JSON.stringify(style) !== JSON.stringify(upstream.doc.styles?.[name]))) {
    const painted = defineStyle(next, name, style);
    next = painted.ok ? painted.doc : next;
  }
  return { doc: resolveVariables(next), map: pull.map, report: pull.report, conflicts: pull.conflicts };
}
