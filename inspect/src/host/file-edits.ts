import { readFile, rm, writeFile } from 'node:fs/promises';
import { stylePatch, type LiveAt } from '@feega/live-edit/class-patch';
import { cssModuleRule } from '@feega/live-edit/css-module';
import type { FileChange, ReadFile } from '@feega/live-edit/files';
import { inside, liveAtOf, reader, tokenOf } from '@feega/live-edit/live-ask';
import { LiveProp } from '@feega/live-edit/live-fields';
import { literalText } from '@feega/live-edit/literal-text';
import { moveNode, type Place } from '@feega/live-edit/move-node';
import { globalSheetOf, googleFontImport, googleFontLink } from '@feega/live-edit/font-wiring';
import { VariableHome, saveVariable, variableName } from '@feega/live-edit/save-variable';
import { StructureOp, structure } from '@feega/live-edit/structure';
import { pageRule } from '@feega/live-edit/page-rule';
import { scopedRule, type Scope } from '@feega/live-edit/scoped-rule';
import { styleAttr, type Css } from '@feega/live-edit/style-attr';
import { detectLibrary } from '@feega/live-edit/icon-library';
import { swapIcon } from '@feega/live-edit/icon-swap';
import { svgMarkup } from '@feega/live-edit/svg-markup';
import { Styling, type EditAsk } from '../messages';
import { StylingChoice } from '../settings';
import { stylingOf } from './styling';

export type Written = { ok: true; path: string; written: string; note?: string } | { ok: false; reason: string; at?: LiveAt };

type Changes = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

type CssWriter = { write: (read: ReadFile, at: LiveAt, css: Css, viewport?: number, scope?: Scope, inner?: string) => Promise<Changes>; note?: string };

const single = (write: typeof scopedRule): CssWriter['write'] => async (read, at, css, viewport, scope, inner) => {
  const out = await write(read, at, css, viewport, scope, inner);
  return out.ok ? { ok: true, changes: [out.change] } : out;
};

const SCOPED: CssWriter = { write: single(scopedRule) };
const MODULE: CssWriter = { write: cssModuleRule };
const INLINE: CssWriter = { write: single(styleAttr), note: 'inline style: this file has no stylesheet' };

const CSS_WRITERS: Record<string, CssWriter> = {
  svelte: SCOPED,
  vue: SCOPED,
  jsx: MODULE,
  tsx: MODULE
};

const cssWriterOf = (file: string): CssWriter => CSS_WRITERS[file.slice(file.lastIndexOf('.') + 1)] ?? INLINE;

type Step = { full: string; before: string; after: string }[];

export type Change = { id: number; at: string; prop: string; value: string; scope: string; files: string[]; time: number };

const NOTHING_TO_UNDO = 'nothing to undo';
const NOTHING_TO_REDO = 'nothing to redo';
const CHANGED_SINCE = 'a file changed after the edit: not restored';

export type Snapshot = { steps: { step: Step; change: Change }[]; undone: { step: Step; change: Change }[] };

export function fileEdits(root: string, choice: () => StylingChoice = () => StylingChoice.Auto, saved?: Snapshot) {
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

  async function writtenAll(changes: FileChange[], token: string, note?: string): Promise<Written> {
    const step: Step = [];
    const moving = changes.filter((c) => c.before !== c.after);
    if (!moving.length) {
      return { ok: true, path: changes[0]?.path ?? '', written: token, note };
    }
    for (const change of moving) {
      const full = inside(root, change.path);
      if (!full) {
        return { ok: false, reason: `${change.path} is outside the workspace` };
      }
      step.push({ full, before: change.before, after: change.after });
    }
    await Promise.all(step.map((s) => writeFile(s.full, s.after)));
    steps.push(step);
    undone.length = 0;
    const change = { ...meta, id: ++nextId, files: moving.map((c) => c.path), time: Date.now() };
    log.unshift(change);
    paths.set(step, change);
    return { ok: true, path: changes[0]?.path ?? '', written: token, note };
  }

  async function edited(ask: EditAsk, extra: FileChange[] = []): Promise<Written> {
    meta = { at: ask.at, prop: ask.prop, value: ask.value ?? '', scope: ask.scope ?? '' };
    const written = (changes: FileChange[], token: string, note?: string) => writtenAll([...changes, ...extra.filter((e) => !changes.some((c) => c.path === e.path))], token, note);
    if (ask.page) {
      const out = await pageRule(reader(root), ask.page, ask.css ?? {}, ask.viewport);
      return out.ok ? written([out.change], '') : out;
    }
    const at = liveAtOf(ask.at);
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${ask.at} is not a file:line:col inside the workspace` };
    }
    if (ask.prop === LiveProp.Text) {
      const out = await literalText(reader(root), at, ask.value ?? '', ask.was);
      if (!out.ok) {
        return out;
      }
      return out.changes.length ? written(out.changes, '') : { ok: true, path: at.file, written: '' };
    }

    if ((await stylingOf(root, choice())) === Styling.Css) {
      const writer = cssWriterOf(at.file);
      const out = await writer.write(reader(root), at, ask.css ?? {}, ask.viewport, ask.scope, ask.inner);
      return out.ok ? written(out.changes, '', writer.note) : out;
    }

    if (ask.inner) {
      return { ok: false, reason: `${at.file}:${at.line}: this ${ask.inner} comes from raw markup; style it from the parent's stylesheet`, at };
    }

    const token = await tokenOf(root, ask);
    const out = await stylePatch(reader(root), at, { prop: ask.prop, family: ask.family, value: token ?? ask.value ?? '', side: ask.side, viewport: ask.viewport });
    if (out.skipped.length) {
      return { ok: false, reason: out.skipped[0] };
    }
    return out.files.length || extra.length ? written(out.files, token ?? '') : { ok: true, path: at.file, written: token ?? '' };
  }

  async function fontEdited(ask: EditAsk, google: boolean): Promise<Written> {
    const sheet = google ? await globalSheetOf(reader(root)) : null;
    const linked = google && !sheet ? await googleFontLink(reader(root), ask.value ?? '') : null;
    const wiring = sheet ? await googleFontImport(reader(root), sheet, ask.value ?? '') : linked;
    const out = await edited(ask, wiring ? [wiring] : []);
    return out.ok && google && !sheet && !linked ? { ...out, note: 'no global stylesheet or page head found: the font is named but not loaded' } : out;
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

  const put = (full: string, text: string) => (text === '' ? rm(full, { force: true }) : writeFile(full, text));

  async function replay(from: Step[], to: Step[], expect: 'before' | 'after', write: 'before' | 'after', empty: string): Promise<Written> {
    const step = from.at(-1);
    if (!step) {
      return { ok: false, reason: empty };
    }
    const now = await Promise.all(step.map((s) => readFile(s.full, 'utf8').catch(() => '')));
    if (now.some((text, i) => text !== step[i][expect])) {
      return { ok: false, reason: CHANGED_SINCE };
    }
    from.pop();
    await Promise.all(step.map((s) => put(s.full, s[write])));
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

  async function restructured(op: StructureOp, rawAt: string, rawTo?: string): Promise<Written> {
    meta = { at: rawAt, prop: op, value: rawTo ?? '', scope: '' };
    const at = liveAtOf(rawAt);
    const to = rawTo ? (liveAtOf(rawTo) ?? undefined) : undefined;
    if (!at || !inside(root, at.file)) {
      return { ok: false, reason: `${rawAt} is not a file:line:col inside the workspace` };
    }
    const out = await structure(reader(root), { op, at, to });
    return out.ok ? writtenAll(out.changes, '', out.note) : out;
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
    saveVariable: (ask: EditAsk, name: string) => inTurn(() => variableSaved(ask, name)),
    structure: (req: { op: StructureOp; at: string; to?: string }) => inTurn(() => restructured(req.op, req.at, req.to)),
    move: (from: string, to: string, place: Place) => inTurn(() => moved(from, to, place)),
    edit: (ask: EditAsk) => inTurn(() => edited(ask)),
    icon: (at: string, name: string) => inTurn(() => iconSwapped(at, name)),
    svg: (at: string, markup: string, inner?: string) => inTurn(() => svgWritten(at, markup, inner)),
    font: (ask: EditAsk, google: boolean) => inTurn(() => fontEdited(ask, google)),
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
