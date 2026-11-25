import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { stylePatch, type LiveAt } from '@feega/live-edit/class-patch';
import { cssModuleRule } from '@feega/live-edit/css-module';
import type { FileChange, ReadFile } from '@feega/live-edit/files';
import type { Structured } from '@feega/live-edit/move-into';
import { inside, liveAtOf, reader, tokenOf } from '@feega/live-edit/live-ask';
import { ClassFamily, LiveProp } from '@feega/live-edit/live-fields';
import { literalText } from '@feega/live-edit/literal-text';
import { moveNode, type Place } from '@feega/live-edit/move-node';
import { detachComponent, type Which } from '@feega/live-edit/detach-component';
import { globalSheetOf, googleFontImport, googleFontLink } from '@feega/live-edit/font-wiring';
import { replaceEverywhere } from '@feega/live-edit/font-replace';
import { VariableHome, saveVariable, variableName } from '@feega/live-edit/save-variable';
import { addedCss, AddKind, AddPlace, AddStyle } from '@feega/live-edit/add-node';
import { wrapperCss, type WrapTag } from '@feega/live-edit/wrap-node';
import { libraryInsert, type InsertItem } from '@feega/live-edit/library-insert';
import type { LoopMove } from '@feega/live-edit/move-loop-item';
import type { Usage } from '@feega/live-edit/move-usage';
import { StructureOp, structure } from '@feega/live-edit/structure';
import { structureMany, type Skipped, type Target } from '@feega/live-edit/structure-many';
import { pageRule } from '@feega/live-edit/page-rule';
import { ElementState } from '@feega/live-edit/element-state';
import { markupFirst } from '@feega/live-edit/markup-first';
import { scopedRule, type Scope } from '@feega/live-edit/scoped-rule';
import { styleAttr, type Css } from '@feega/live-edit/style-attr';
import { targetOf } from '@feega/live-edit/breakpoints';
import { DEFAULT_THEME, combinedMedia, themeTarget } from '@feega/live-edit/themes';
import { detectLibrary } from '@feega/live-edit/icon-library';
import { swapIcon } from '@feega/live-edit/icon-swap';
import { svgMarkup } from '@feega/live-edit/svg-markup';
import { addGo, type GoAsk } from '@feega/live-edit/go-action';
import { linkWrite, type LinkEdit } from '@feega/live-edit/link-edit';
import { attributeWrite } from '@feega/live-edit/attribute-edit';
import { applyProps, type Applied } from '@feega/live-edit/apply-props';
import type { Proposal } from '@feega/plugin-api/protocol';
import { Styling, type ApplyAsk, type EditAsk, type ImpactAsk } from '../messages';
import { StylingChoice } from '../settings';
import { stylingOf } from './styling';
import { breakpointsOf } from './breakpoints';
import { themesOf } from './themes';
import { proposalChanges } from './proposal';
import { filesIn } from './wiring';
import { scanProject } from './project-scan';

export type StructureAsk = { op: StructureOp; at: string; to?: string; usage?: Usage; loop?: LoopMove; instance?: number; add?: { kind: AddKind; src?: string; place?: AddPlace }; wrap?: WrapTag };

export type DetachAsk = { at: string; usage: string; which: Which };

export type ManyAsk = { op: StructureOp; targets: { at: string; instance?: number }[]; wrap?: WrapTag };

export type Written = { ok: true; path: string; written: string; note?: string; selected?: LiveAt; changes?: FileChange[]; touched?: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

type Changes = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

type CssWriter = { write: (read: ReadFile, at: LiveAt, css: Css, viewport?: number, scope?: Scope, inner?: string, state?: ElementState, media?: string | null, within?: string | null) => Promise<Changes>; note?: string };

const single = (write: typeof scopedRule): CssWriter['write'] => async (read, at, css, viewport, scope, inner, state, media, within) => {
  const out = await write(read, at, css, viewport, scope, inner, state, media, within);
  return out.ok ? { ok: true, changes: [out.change] } : out;
};

const SCOPED: CssWriter = { write: single(scopedRule) };
const MODULE: CssWriter = { write: cssModuleRule };
const inlineStyle = single(styleAttr);

const HIDING: CssWriter = { write: inlineStyle };

const INLINE: CssWriter = {
  write: async (read, at, css, viewport, scope, inner, state = ElementState.Default, media, within) => {
    const needs = state !== ElementState.Default ? state : typeof media === 'string' ? 'a breakpoint or theme' : within ? 'a theme' : null;
    return needs ? { ok: false, reason: `${at.file}:${at.line}: ${needs} needs a stylesheet rule, this file has none`, at } : inlineStyle(read, at, css, viewport, scope, inner);
  },
  note: 'inline style: this file has no stylesheet'
};

const CSS_WRITERS: Record<string, CssWriter> = {
  svelte: SCOPED,
  vue: SCOPED,
  astro: SCOPED,
  jsx: MODULE,
  tsx: MODULE
};

const STAGED_WRITES: Record<string, (from: string, to: string) => string | null> = { astro: markupFirst };

const stagedOf = (file: string) => STAGED_WRITES[file.slice(file.lastIndexOf('.') + 1)];

export type Settle = () => Promise<void>;

const cssWriterOf = (file: string): CssWriter => CSS_WRITERS[file.slice(file.lastIndexOf('.') + 1)] ?? INLINE;

const afterChanges = (read: ReadFile, changes: FileChange[]): ReadFile => async (path) => changes.find((c) => c.path === path)?.after ?? read(path);

const mergedChanges = (first: FileChange[], more: FileChange[]): FileChange[] => [
  ...first.map((c) => ({ ...c, after: more.find((m) => m.path === c.path)?.after ?? c.after })),
  ...more.filter((m) => !first.some((c) => c.path === m.path))
];

async function ruled(read: ReadFile, out: Extract<Structured, { ok: true }>, css: Css): Promise<Structured> {
  const target = out.selected;
  if (!target || !Object.keys(css).length) {
    return out;
  }

  const rule = await cssWriterOf(target.file).write(afterChanges(read, out.changes), target, css);
  return rule.ok ? { ...out, changes: mergedChanges(out.changes, rule.changes) } : rule;
}

export enum Commit {
  Write = 'write',
  Preview = 'preview',
  Record = 'record'
}

const PROBE_CSS: Css = { 'outline-offset': '7.25px' };

type Step = { full: string; before: string; after: string; encoding?: 'base64' }[];

export type Change = { id: number; at: string; prop: string; value: string; scope: string; files: string[]; time: number };

const NOTHING_TO_UNDO = 'nothing to undo';
const NOTHING_TO_REDO = 'nothing to redo';
const CHANGED_SINCE = 'a file changed after the edit: not restored';
const FONT_NOT_LOADED = 'no global stylesheet or page head found: the font is named but not loaded';
const FONT_CONFIGS = ['tailwind.config.mjs', 'tailwind.config.cjs'];

export type Snapshot = { steps: { step: Step; change: Change }[]; undone: { step: Step; change: Change }[] };

export function fileEdits(root: string, choice: () => StylingChoice = () => StylingChoice.Auto, saved?: Snapshot, settle: Settle = async () => undefined) {
  const paths = new Map<Step, Change>();
  const restore = (list: Snapshot['steps']) => list.map(({ step, change }) => (paths.set(step, change), step));
  const steps: Step[] = restore(saved?.steps ?? []);
  const undone: Step[] = restore(saved?.undone ?? []);
  const log: Change[] = steps.map((s) => paths.get(s)!).reverse();
  let nextId = Math.max(0, ...log.map((c) => c.id));
  let meta: Omit<Change, 'id' | 'files' | 'time'> = { at: '', prop: '', value: '', scope: '' };
  let turn: Promise<unknown> = Promise.resolve();

  const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const next = turn.then(work, work);
    turn = next.catch(() => undefined);
    return next;
  };

  async function writtenAll(changes: FileChange[], token: string, note?: string, mode = Commit.Write): Promise<Written> {
    const step: Step = [];
    const moving = changes.filter((c) => c.before !== c.after);
    if (mode === Commit.Preview) {
      return { ok: true, path: changes[0]?.path ?? '', written: token, note, changes: moving };
    }
    if (!moving.length) {
      return { ok: true, path: changes[0]?.path ?? '', written: token, note };
    }
    for (const change of moving) {
      const full = inside(root, change.path);
      if (!full) {
        return { ok: false, reason: `${change.path} is outside the workspace` };
      }
      step.push({ full, before: change.before, after: change.after, encoding: change.encoding });
    }
    if (mode === Commit.Write) {
      await Promise.all(step.map((s) => mkdir(dirname(s.full), { recursive: true })));
      await Promise.all(step.map((s) => staged(s.full, s.before, s.after, s.encoding)));
      await Promise.all(step.map((s) => writeFile(s.full, s.after, s.encoding)));
    }
    steps.push(step);
    undone.length = 0;
    const change = { ...meta, id: ++nextId, files: moving.map((c) => c.path), time: Date.now() };
    log.unshift(change);
    paths.set(step, change);
    return { ok: true, path: changes[0]?.path ?? '', written: token, note, touched: moving };
  }

  async function edited(ask: EditAsk, extra: FileChange[] = [], mode = Commit.Write): Promise<Written> {
    meta = { at: ask.at, prop: ask.prop, value: ask.value ?? '', scope: ask.scope ?? '' };
    const written = (changes: FileChange[], token: string, note?: string) => writtenAll([...changes, ...extra.filter((e) => !changes.some((c) => c.path === e.path))], token, note, mode);
    const breakpoint = ask.breakpoint === undefined ? undefined : targetOf(await breakpointsOf(root), ask.breakpoint);
    if (breakpoint === null) {
      return { ok: false, reason: `${ask.breakpoint} is not a breakpoint of this project` };
    }
    const theme = ask.theme === undefined || ask.theme === DEFAULT_THEME ? undefined : themeTarget(await themesOf(root), ask.theme);
    if (theme === null) {
      return { ok: false, reason: `${ask.theme} is not a theme of this project` };
    }
    const media = theme ? combinedMedia(breakpoint?.media, theme.media) : breakpoint?.media;
    const within = theme?.within;
    if (ask.page) {
      const out = await pageRule(reader(root), ask.page, ask.css ?? {}, ask.viewport, media, within);
      return out.ok ? written([out.change], '') : out;
    }
    const at = liveAtOf(ask.at);
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${ask.at} is not a file:line:col inside the workspace` };
    }
    if (ask.prop === LiveProp.Text) {
      const out = await literalText(reader(root), at, ask.value ?? '', ask.was, ask.instance);
      if (!out.ok) {
        return out;
      }
      return out.changes.length ? written(out.changes, '') : { ok: true, path: at.file, written: '' };
    }

    if ((await stylingOf(root, choice())) === Styling.Css) {
      const writer = ask.family === ClassFamily.Hidden ? HIDING : cssWriterOf(at.file);
      const out = await writer.write(reader(root), at, ask.css ?? {}, ask.viewport, ask.scope, ask.inner, ask.state, media, within);
      return out.ok ? written(out.changes, '', writer.note) : out;
    }

    if (ask.inner) {
      return { ok: false, reason: `${at.file}:${at.line}: this ${ask.inner} comes from raw markup; style it from the parent's stylesheet`, at };
    }

    if (theme?.variant === null) {
      return { ok: false, reason: `${ask.theme} has no Tailwind variant: style it from a stylesheet`, at };
    }
    const variant = theme ? [breakpoint?.variant, theme.variant].filter(Boolean).join(':') : breakpoint?.variant;
    const token = await tokenOf(root, ask);
    const out = await stylePatch(reader(root), at, { prop: ask.prop, family: ask.family, value: token ?? ask.value ?? '', side: ask.side, viewport: ask.viewport, state: ask.state, variant });
    if (out.skipped.length) {
      return { ok: false, reason: out.skipped[0] };
    }
    return out.files.length || extra.length ? written(out.files, token ?? '') : { ok: true, path: at.file, written: token ?? '' };
  }

  async function targetsOf(ask: ImpactAsk): Promise<string[] | null> {
    const at = liveAtOf(ask.at);
    if (!at) {
      return null;
    }
    if ((await stylingOf(root, choice())) !== Styling.Css) {
      return [at.file];
    }
    const out = await edited({ ...ask, prop: LiveProp.Color, value: undefined, css: PROBE_CSS }, [], Commit.Preview);
    return out.ok ? (out.changes ?? []).map((c) => c.path) : null;
  }

  async function fontWiring(read: ReadFile, family: string, google: boolean): Promise<{ changes: FileChange[]; unloaded: boolean }> {
    if (!google) {
      return { changes: [], unloaded: false };
    }
    const sheet = await globalSheetOf(read);
    const wiring = sheet ? await googleFontImport(read, sheet, family) : await googleFontLink(read, family);
    return { changes: wiring ? [wiring] : [], unloaded: !sheet && !wiring };
  }

  async function fontEdited(ask: EditAsk, google: boolean): Promise<Written> {
    const wiring = await fontWiring(reader(root), ask.value ?? '', google);
    const out = await edited(ask, wiring.changes);
    return out.ok && wiring.unloaded ? { ...out, note: FONT_NOT_LOADED } : out;
  }

  async function projectSources(): Promise<{ path: string; text: string }[]> {
    const scan = await scanProject(root, Infinity);
    const paths = [...new Set([...scan.sheets, ...scan.sources].map((full) => relative(root, full)).concat(FONT_CONFIGS))];
    const read = reader(root);
    const files = await Promise.all(paths.map(async (path) => ({ path, text: await read(path) })));
    return files.filter((f): f is { path: string; text: string } => f.text !== null);
  }

  async function fontReplaced(from: string, to: string, google: boolean): Promise<Written> {
    meta = { at: '', prop: 'font-family', value: to, scope: 'project' };
    const replaced = replaceEverywhere(await projectSources(), from, to);
    if (!replaced.length) {
      return { ok: false, reason: `${from} is not named in any source file` };
    }
    const wiring = await fontWiring(afterChanges(reader(root), replaced), to, google);
    const count = `Replaced ${from} with ${to} in ${replaced.length} ${replaced.length === 1 ? 'file' : 'files'}`;
    return writtenAll(mergedChanges(replaced, wiring.changes), to, wiring.unloaded ? `${count}. ${FONT_NOT_LOADED}` : count);
  }

  async function fontLoaded(family: string): Promise<Written> {
    meta = { at: '', prop: 'font-load', value: family, scope: 'project' };
    const wiring = await fontWiring(reader(root), family, true);
    return writtenAll(wiring.changes, family, wiring.unloaded ? FONT_NOT_LOADED : undefined);
  }

  async function iconSwapped(rawAt: string, name: string): Promise<Written> {
    meta = { at: rawAt, prop: 'icon', value: name, scope: '' };
    const at = liveAtOf(rawAt);
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const library = detectLibrary((await reader(root)('package.json')) ?? '');
    if (!library) {
      return { ok: false, reason: 'no icon library found in package.json' };
    }
    const out = await swapIcon(reader(root), at, name, library);
    return out.ok ? writtenAll([out.change], '') : out;
  }

  async function svgWritten(rawAt: string, markup: string, inner?: string): Promise<Written> {
    meta = { at: rawAt, prop: 'svg', value: '', scope: '' };
    const at = liveAtOf(rawAt);
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await svgMarkup(reader(root), at, markup, inner);
    return out.ok ? writtenAll(out.changes, '') : out;
  }

  const placed = (rawAt: string): LiveAt | null => {
    const at = liveAtOf(rawAt);
    return at && inside(root, at.file) ? at : null;
  };

  async function linkWritten(rawAt: string, edit: LinkEdit, instance?: number): Promise<Written> {
    meta = { at: rawAt, prop: 'link', value: 'href' in edit ? edit.href : edit.opens, scope: '' };
    const at = placed(rawAt);
    if (!at) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await linkWrite(reader(root), at, edit, instance);
    return out.ok ? writtenAll(out.changes, '') : out;
  }

  async function attributeWritten(rawAt: string, name: string, value: string): Promise<Written> {
    meta = { at: rawAt, prop: name, value, scope: '' };
    const at = placed(rawAt);
    if (!at) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await attributeWrite(reader(root), at, name, value);
    return out.ok ? writtenAll([out.change], '') : out;
  }

  async function propsPlanned(ask: ApplyAsk): Promise<Applied> {
    const usage = placed(ask.usage);
    if (!usage) {
      return { ok: false, reason: `${ask.usage} is not a file:line:col inside the workspace` };
    }
    return applyProps(reader(root), { component: ask.component, usage, which: ask.which, set: ask.set, remove: ask.remove });
  }

  async function propsWritten(ask: ApplyAsk): Promise<Written> {
    meta = { at: ask.usage, prop: 'props', value: [...Object.keys(ask.set), ...ask.remove].join(', '), scope: '' };
    const out = await propsPlanned(ask);
    if (!out.ok) {
      return out;
    }
    const note = out.skipped.length ? `Not written: ${out.skipped.join(', ')}` : undefined;
    return writtenAll([out.change], '', note);
  }

  async function goWritten(rawAt: string, ask: GoAsk): Promise<Written> {
    meta = { at: rawAt, prop: 'go', value: `${ask.go} ${ask.target}`, scope: '' };
    const at = placed(rawAt);
    if (!at) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await addGo(reader(root), at, ask);
    return out.ok ? writtenAll(out.changes, '') : out;
  }

  const put = (full: string, text: string, encoding?: 'base64') => (text === '' ? rm(full, { force: true }) : writeFile(full, text, encoding));

  async function staged(full: string, from: string, to: string, encoding?: 'base64') {
    const first = encoding || !from || !to ? null : stagedOf(full)?.(from, to);
    if (typeof first === 'string') {
      await put(full, first);
      await settle();
    }
  }

  async function replay(from: Step[], to: Step[], expect: 'before' | 'after', write: 'before' | 'after', empty: string): Promise<Written> {
    const step = from.at(-1);
    if (!step) {
      return { ok: false, reason: empty };
    }
    const now = await Promise.all(step.map((s) => readFile(s.full, s.encoding ?? 'utf8').catch(() => '')));
    if (now.some((text, i) => text !== step[i][expect])) {
      return { ok: false, reason: CHANGED_SINCE };
    }
    from.pop();
    await Promise.all(step.map((s) => staged(s.full, s[expect], s[write], s.encoding)));
    await Promise.all(step.map((s) => put(s.full, s[write], s.encoding)));
    to.push(step);
    return { ok: true, path: step[0]?.full ?? '', written: '' };
  }

  async function undoStep(): Promise<Written> {
    const out = await replay(steps, undone, 'after', 'before', NOTHING_TO_UNDO);
    const step = undone.at(-1);
    if (out.ok && step) {
      log.splice(log.indexOf(paths.get(step)!), 1);
    }
    return out;
  }

  async function redoStep(): Promise<Written> {
    const out = await replay(undone, steps, 'before', 'after', NOTHING_TO_REDO);
    const step = steps.at(-1);
    if (out.ok && step) {
      log.unshift(paths.get(step)!);
    }
    return out;
  }

  async function moved(from: string, to: string, place: Place): Promise<Written> {
    meta = { at: from, prop: 'order', value: `${place} ${to}`, scope: '' };
    const a = liveAtOf(from);
    const b = liveAtOf(to);
    if (!a || !b || !inside(root, a.file)) {
      return { ok: false, reason: `${from} is not a file:line:col inside the workspace` };
    }
    const out = await moveNode(reader(root), a, b, place);
    return out.ok ? writtenAll([out.change], '') : out;
  }

  async function restructured(ask: StructureAsk): Promise<Written> {
    const { op, at: rawAt, to: rawTo, usage, loop, instance, wrap } = ask;
    const tailwind = (await stylingOf(root, choice())) === Styling.Tailwind;
    const style = tailwind ? AddStyle.Tailwind : AddStyle.Plain;
    const add = ask.add && { ...ask.add, style };
    meta = { at: rawAt, prop: op, value: rawTo ?? usage?.from ?? '', scope: '' };
    const at = liveAtOf(rawAt);
    const to = rawTo ? (liveAtOf(rawTo) ?? undefined) : undefined;
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const made = await structure(reader(root), { op, at, to, usage, loop, instance, add, style, wrap });
    const css = tailwind ? {} : op === StructureOp.Wrap ? wrapperCss(wrap) : add ? addedCss(add.kind) : {};
    const out = made.ok ? await ruled(reader(root), made, css) : made;
    const written = out.ok ? await writtenAll(out.changes, '', out.note) : out;
    return out.ok && written.ok ? { ...written, selected: out.selected } : written;
  }

  async function detached(rawAt: string, rawUsage: string, which: Which): Promise<Written> {
    meta = { at: rawAt, prop: 'detach', value: rawUsage, scope: '' };
    const element = placed(rawAt);
    const usage = placed(rawUsage);
    if (!element || !usage) {
      return { ok: false, reason: `${element ? rawUsage : rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await detachComponent(reader(root), { element, usage, which });
    const written = out.ok ? await writtenAll(out.changes, '') : out;
    return out.ok && written.ok ? { ...written, selected: out.selected } : written;
  }

  async function libraryWritten(rawAt: string, place: AddPlace, item: InsertItem, tokens: string): Promise<Written> {
    meta = { at: rawAt, prop: 'library', value: item.id, scope: '' };
    const at = placed(rawAt);
    if (!at) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await libraryInsert(reader(root), at, place, item, tokens);
    if (!out.ok) {
      return out;
    }
    const written = await writtenAll(out.changes, '', out.note);
    return written.ok ? { ...written, selected: out.selected } : written;
  }

  async function pageWritten(route: string, changes: FileChange[]): Promise<Written> {
    meta = { at: changes[0]?.path ?? '', prop: 'page', value: route, scope: '' };
    return writtenAll(changes, '');
  }

  async function proposed(proposal: Proposal, appDir: string): Promise<Written> {
    const first = proposal.ops.find((op) => 'at' in op);
    meta = { at: first && 'at' in first ? first.at : '', prop: 'plugin', value: proposal.label, scope: '' };
    const out = await proposalChanges(proposal.ops, { root, read: reader(root), files: () => filesIn(root), appDir, style: (read, at, css) => cssWriterOf(at.file).write(read, at, css) });
    return out.ok ? writtenAll(out.changes, '') : out;
  }

  async function agentWritten(path: string, content: string, agent: string): Promise<Written> {
    meta = { at: path, prop: 'agent', value: agent, scope: '' };
    const before = (await reader(root)(path)) ?? '';
    return writtenAll([{ path, before, after: content }], '');
  }

  async function agentRecorded(path: string, before: string, after: string, agent: string): Promise<Written> {
    meta = { at: path, prop: 'agent', value: agent, scope: '' };
    return writtenAll([{ path, before, after }], '', undefined, Commit.Record);
  }

  const skippedNote = (total: number, skipped: Skipped[]): string | undefined => {
    const reasons = [...new Set(skipped.map((s) => s.reason))].join('; ');
    return skipped.length ? `${total - skipped.length} of ${total} changed · skipped: ${reasons}` : undefined;
  };

  async function restructuredMany(ask: ManyAsk): Promise<Written> {
    const { op, wrap } = ask;
    const tailwind = (await stylingOf(root, choice())) === Styling.Tailwind;
    const style = tailwind ? AddStyle.Tailwind : AddStyle.Plain;
    meta = { at: ask.targets[0]?.at ?? '', prop: op, value: `${ask.targets.length} elements`, scope: '' };
    const outside: Skipped[] = [];
    const targets: Target[] = [];
    for (const target of ask.targets) {
      const at = placed(target.at);
      if (at) {
        targets.push({ at, instance: target.instance });
        continue;
      }
      outside.push({ at: { file: target.at, line: 0, col: 0 }, reason: `${target.at} is not a file:line:col inside the workspace` });
    }
    const made = await structureMany(reader(root), { op, targets, style, wrap });
    if (!made.ok) {
      return made;
    }
    const css = tailwind ? {} : op === StructureOp.Wrap ? wrapperCss(wrap) : {};
    const out = await ruled(reader(root), { ok: true, changes: made.changes, selected: made.selected }, css);
    const note = skippedNote(ask.targets.length, [...outside, ...made.skipped]);
    const written = out.ok ? await writtenAll(out.changes, '', note ?? out.note) : out;
    return out.ok && written.ok ? { ...written, selected: out.selected } : written;
  }

  async function variableSaved(ask: EditAsk, name: string): Promise<Written> {
    const sheet = await globalSheetOf(reader(root));
    if (!sheet) {
      return { ok: false, reason: 'no global stylesheet found to hold the variable' };
    }
    const before = (await reader(root)(sheet)) ?? '';
    const tailwind = (await stylingOf(root, choice())) === Styling.Tailwind;
    const home = tailwind && before.includes('tailwindcss') ? VariableHome.Theme : VariableHome.Root;
    const change = { path: sheet, before, after: saveVariable(before, name, ask.value ?? '', home) };
    const css = Object.fromEntries(Object.keys(ask.css ?? {}).map((prop) => [prop, `var(${variableName(name, home)})`]));
    const applied: EditAsk = { ...ask, token: home === VariableHome.Theme ? name : `[var(${variableName(name, home)})]`, css };
    return edited(applied, [change]);
  }

  return {
    proposal: (proposal: Proposal, appDir: string) => inTurn(() => proposed(proposal, appDir)),
    agentWrite: (path: string, content: string, agent: string) => inTurn(() => agentWritten(path, content, agent)),
    agentRecord: (path: string, before: string, after: string, agent: string) => inTurn(() => agentRecorded(path, before, after, agent)),
    saveVariable: (ask: EditAsk, name: string) => inTurn(() => variableSaved(ask, name)),
    structure: (ask: StructureAsk) => inTurn(() => restructured(ask)),
    detach: (ask: DetachAsk) => inTurn(() => detached(ask.at, ask.usage, ask.which)),
    library: (at: string, place: AddPlace, item: InsertItem, tokens: string) => inTurn(() => libraryWritten(at, place, item, tokens)),
    page: (route: string, changes: FileChange[]) => inTurn(() => pageWritten(route, changes)),
    structureMany: (ask: ManyAsk) => inTurn(() => restructuredMany(ask)),
    move: (from: string, to: string, place: Place) => inTurn(() => moved(from, to, place)),
    edit: (ask: EditAsk) => inTurn(() => edited(ask)),
    preview: (ask: EditAsk) => inTurn(() => edited(ask, [], Commit.Preview)),
    targets: (ask: ImpactAsk) => inTurn(() => targetsOf(ask)),
    icon: (at: string, name: string) => inTurn(() => iconSwapped(at, name)),
    svg: (at: string, markup: string, inner?: string) => inTurn(() => svgWritten(at, markup, inner)),
    font: (ask: EditAsk, google: boolean) => inTurn(() => fontEdited(ask, google)),
    replaceFont: (from: string, to: string, google: boolean) => inTurn(() => fontReplaced(from, to, google)),
    loadFont: (family: string) => inTurn(() => fontLoaded(family)),
    link: (at: string, edit: LinkEdit, instance?: number) => inTurn(() => linkWritten(at, edit, instance)),
    attribute: (at: string, name: string, value: string) => inTurn(() => attributeWritten(at, name, value)),
    propsPlan: (ask: ApplyAsk) => inTurn(() => propsPlanned(ask)),
    applyProps: (ask: ApplyAsk) => inTurn(() => propsWritten(ask)),
    go: (at: string, ask: GoAsk) => inTurn(() => goWritten(at, ask)),
    undo: () => inTurn(undoStep),
    redo: () => inTurn(redoStep),
    history: (): Change[] => log.map((c) => ({ ...c })),
    canUndo: () => steps.length > 0,
    canRedo: () => undone.length > 0,
    latest: () => log[0]?.id ?? null,
    beforeOf: (id: number): { full: string; before: string }[] => {
      const step = [...paths].find(([, c]) => c.id === id)?.[0];
      return step ? step.map(({ full, before }) => ({ full, before })) : [];
    },
    snapshot: (): Snapshot => ({ steps: steps.map((step) => ({ step, change: paths.get(step)! })), undone: undone.map((step) => ({ step, change: paths.get(step)! })) })
  };
}
