import { restoreRows, type OptimisticOp } from './optimistic-ops';
import { nextCanvasName } from './canvas-names';
import { ShareState } from './shared-view';

export enum PageAction {
  New = 'new_canvas',
  Rename = 'rename_canvas',
  Delete = 'delete_canvas',
  Share = 'share_canvas'
}

export type PageRow = { id: string; name: string; href: string };
export type ShareWritten = { canvasId: string; token: string | null };
export type Shell = { pages: PageRow[]; share: ShareWritten | null };
export type ShellTouched = { pages: readonly string[]; share: boolean };

type Inputs = {
  [PageAction.New]: { id: string; from: string; projectId: string };
  [PageAction.Rename]: { id: string; name: string };
  [PageAction.Delete]: { id: string };
  [PageAction.Share]: { canvasId: string; token: string | null };
};

type Row<I> = {
  canvasId: (input: I) => string;
  fields: (input: I) => Record<string, string>;
  apply: (shell: Shell, input: I) => Shell;
  touched: (input: I) => ShellTouched;
  notice: string;
};

const pagesOnly = (id: string): ShellTouched => ({ pages: [id], share: false });

const REGISTRY: { [K in PageAction]: Row<Inputs[K]> } = {
  [PageAction.New]: {
    canvasId: (i) => i.from,
    fields: (i) => ({ id: i.id }),
    apply: (s, i) => ({ ...s, pages: [...s.pages, { id: i.id, name: nextCanvasName(s.pages.map((p) => p.name)), href: `/p/${i.projectId}/c/${i.id}` }] }),
    touched: (i) => pagesOnly(i.id),
    notice: 'The new page did not save and was removed.'
  },
  [PageAction.Rename]: {
    canvasId: (i) => i.id,
    fields: (i) => ({ name: i.name }),
    apply: (s, i) => ({ ...s, pages: s.pages.map((p) => (p.id === i.id && i.name.trim() ? { ...p, name: i.name.trim() } : p)) }),
    touched: (i) => pagesOnly(i.id),
    notice: 'The new page name did not save and was undone.'
  },
  [PageAction.Delete]: {
    canvasId: (i) => i.id,
    fields: () => ({}),
    apply: (s, i) => ({ ...s, pages: s.pages.filter((p) => p.id !== i.id) }),
    touched: (i) => pagesOnly(i.id),
    notice: 'Delete did not save; the page is back.'
  },
  [PageAction.Share]: {
    canvasId: (i) => i.canvasId,
    fields: (i): Record<string, string> => (i.token ? { state: ShareState.On, token: i.token } : { state: ShareState.Off }),
    apply: (s, i) => ({ ...s, share: { canvasId: i.canvasId, token: i.token } }),
    touched: () => ({ pages: [], share: true }),
    notice: 'Sharing did not save and was undone.'
  }
};

export type PageOp = { canvasId: string; action: PageAction; fields: Record<string, string>; apply: (shell: Shell) => Shell; touched: ShellTouched; notice: string };

export function pageOp<K extends PageAction>(action: K, input: Inputs[K]): PageOp {
  const row = REGISTRY[action] as Row<Inputs[K]>;
  return { canvasId: row.canvasId(input), action, fields: row.fields(input), apply: (s) => row.apply(s, input), touched: row.touched(input), notice: row.notice };
}

export const restoreShell = (current: Shell, before: Shell, touched: ShellTouched): Shell => ({
  pages: restoreRows(current.pages, before.pages, touched.pages),
  share: touched.share ? before.share : current.share
});

export type PagePost = (op: PageOp) => Promise<Record<string, unknown> | null>;

export const runnablePage = (op: PageOp, post: PagePost): OptimisticOp<Shell, Record<string, unknown>, ShellTouched> => ({
  apply: op.apply,
  touched: op.touched,
  send: () => post(op),
  undo: () => [],
  notice: op.notice
});
