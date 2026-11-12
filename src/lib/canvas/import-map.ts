import { z } from 'zod';

export const MAX_FRAME_BOARDS = 20;

const MAX_MAP_PAGES = 500;
const MAX_VALUES = 8;
const MAX_NAMES = 500;
const PATH_MAX = 300;
const NAME_MAX = 200;

export enum PageState {
  Imported = 'imported',
  NotSelected = 'not_selected',
  NeedsValue = 'needs_value',
  Failed = 'failed',
  Locked = 'locked'
}

export enum Scheme {
  Light = 'light',
  Dark = 'dark'
}

export type Cond = { scheme: Scheme; width: number };

const COND_SEPARATOR = '@';

export const condKey = (c: { scheme: string; width: number }): string => `${c.scheme}${COND_SEPARATOR}${c.width}`;

export function condOf(key: string): Cond {
  const [scheme, width] = key.split(COND_SEPARATOR);
  return { scheme: scheme === Scheme.Dark ? Scheme.Dark : Scheme.Light, width: Number(width) };
}

export const BASE_COND: Cond = { scheme: Scheme.Light, width: 1280 };

export const COND_CHOICES: Cond[] = [Scheme.Light, Scheme.Dark].flatMap((scheme) => [1280, 768, 390].map((width) => ({ scheme, width })));

export const condLabel = (c: Cond): string => `${c.scheme === Scheme.Dark ? 'Dark' : 'Light'} · ${c.width}`;

const boardSchema = z.object({ cond: z.string().max(24), clip: z.string().min(1).max(64) });

const pageSchema = z.object({
  path: z.string().max(PATH_MAX),
  state: z.enum(PageState),
  boards: z.array(boardSchema).max(MAX_FRAME_BOARDS).optional(),
  reason: z.string().max(PATH_MAX).optional(),
  values: z.array(z.string().max(PATH_MAX)).max(MAX_VALUES).optional()
});

const names = z.array(z.string().max(NAME_MAX)).max(MAX_NAMES);
const count = z.number().int().min(0);

export const importMapSchema = z.object({
  rev: z.string().max(64).nullable().optional(),
  pages: z.array(pageSchema).max(MAX_MAP_PAGES),
  library: z.object({ captured: names, uncaptured: names }).optional(),
  design: z.object({ tokens: count, styles: count, bound: count, unbound: count }).optional(),
  unrun: z.string().max(PATH_MAX).optional()
});

export type ImportMap = z.infer<typeof importMapSchema>;
export type MapPage = ImportMap['pages'][number];
export type MapBoard = z.infer<typeof boardSchema>;

export enum Shown {
  OnCanvas = 'on_canvas',
  Removed = 'removed',
  NotSelected = 'not_selected',
  NeedsValue = 'needs_value',
  Failed = 'failed',
  Locked = 'locked'
}

export enum PageAction {
  Zoom = 'zoom',
  Import = 'import',
  Retry = 'retry',
  SetValue = 'set_value',
  SignIn = 'sign_in'
}

export enum Tone {
  Done = 'done',
  Idle = 'idle',
  Warn = 'warn',
  Bad = 'bad'
}

type RowRule = { chip: string; tone: Tone; action: PageAction; label: string };

export const PAGE_ROWS: Record<Shown, RowRule> = {
  [Shown.OnCanvas]: { chip: 'On canvas', tone: Tone.Done, action: PageAction.Zoom, label: 'Show' },
  [Shown.Removed]: { chip: 'Not on canvas', tone: Tone.Idle, action: PageAction.Import, label: 'Import' },
  [Shown.NotSelected]: { chip: 'Not imported', tone: Tone.Idle, action: PageAction.Import, label: 'Import' },
  [Shown.NeedsValue]: { chip: 'Needs a value', tone: Tone.Warn, action: PageAction.SetValue, label: 'Set value…' },
  [Shown.Failed]: { chip: 'Failed', tone: Tone.Bad, action: PageAction.Retry, label: 'Retry' },
  [Shown.Locked]: { chip: 'Needs sign-in', tone: Tone.Warn, action: PageAction.SignIn, label: 'Sign in…' }
};

const SHOWN_OF: Record<PageState, Shown> = {
  [PageState.Imported]: Shown.OnCanvas,
  [PageState.NotSelected]: Shown.NotSelected,
  [PageState.NeedsValue]: Shown.NeedsValue,
  [PageState.Failed]: Shown.Failed,
  [PageState.Locked]: Shown.Locked
};

export type MapRow = { path: string; shown: Shown; rule: RowRule; boards: MapBoard[]; missing: Cond[]; reason?: string; values: string[] };

export function mapRows(map: ImportMap, onCanvas: (clipId: string) => boolean): MapRow[] {
  return map.pages.map((page) => {
    const boards = (page.boards ?? []).filter((b) => onCanvas(b.clip));
    const shown = page.state === PageState.Imported && !boards.length ? Shown.Removed : SHOWN_OF[page.state];
    const present = new Set(boards.map((b) => b.cond));
    return { path: page.path, shown, rule: PAGE_ROWS[shown], boards, missing: COND_CHOICES.filter((c) => !present.has(condKey(c))), ...(page.reason ? { reason: page.reason } : {}), values: page.values ?? [] };
  });
}

export const boardsUsed = (map: ImportMap | undefined, onCanvas: (clipId: string) => boolean): number => (map?.pages ?? []).flatMap((p) => p.boards ?? []).filter((b) => onCanvas(b.clip)).length;

const ROUTE_PARAM = /\[[^\]]+\]/;

export const isPattern = (path: string): boolean => ROUTE_PARAM.test(path);

function mergedPage(before: MapPage | undefined, after: MapPage): MapPage {
  const boards = [...new Map([...(before?.boards ?? []), ...(after.boards ?? [])].map((b) => [b.cond, b])).values()];
  if (!boards.length) {
    return after;
  }
  return { path: after.path, state: PageState.Imported, boards };
}

export function mergedMap(before: ImportMap | undefined, after: ImportMap): ImportMap {
  const was = new Map((before?.pages ?? []).map((p) => [p.path, p]));
  const now = new Map(after.pages.map((p) => [p.path, p]));
  const paths = [...new Set([...was.keys(), ...now.keys()])];
  const pages = paths.map((path) => (now.has(path) ? mergedPage(was.get(path), now.get(path)!) : was.get(path)!));
  const library = before?.library && after.library ? { captured: [...new Set([...before.library.captured, ...after.library.captured])], uncaptured: after.library.uncaptured.filter((n) => !before.library!.captured.includes(n)) } : (after.library ?? before?.library);
  const design = before?.design && after.design ? { ...before.design, bound: before.design.bound + after.design.bound, unbound: before.design.unbound + after.design.unbound } : (after.design ?? before?.design);
  return { rev: after.rev ?? before?.rev ?? null, pages, ...(library ? { library } : {}), ...(design ? { design } : {}) };
}
