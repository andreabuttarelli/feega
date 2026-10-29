import { invalidate } from '$app/navigation';
import { postCanvasAction } from './canvas-api';
import { canvasRouteOf } from './canvas-action-url';
import { CANVAS_LIST_DEPENDENCY } from './canvas-list';
import { OpOutcome, createOptimistic } from './optimistic-ops';
import { pageOp, restoreShell, runnablePage, type PageAction, type PageOp, type PageRow, type Shell, type ShellTouched, type ShareWritten } from './page-ops';

const LANDED = new Set(['success', 'redirect']);

let pages = $state<PageRow[] | null>(null);
let share = $state<ShareWritten | null>(null);
let notice = $state<string | null>(null);
let base: PageRow[] = [];
let inFlight = 0;

async function send(op: PageOp, projectId: string): Promise<Record<string, unknown> | null> {
  const body = new FormData();
  Object.entries(op.fields).forEach(([key, value]) => body.set(key, value));
  const result = await postCanvasAction({ projectId, canvasId: op.canvasId }, op.action, body);
  return LANDED.has(result.type) ? { ...(result.type === 'success' ? result.data : {}) } : null;
}

const run = createOptimistic<Shell, ShellTouched>(
  {
    read: () => ({ pages: pages ?? base, share }),
    write: (shell) => {
      pages = shell.pages;
      share = shell.share;
    },
    reserve: () => () => {},
    hold: () => {
      inFlight += 1;
      return () => {
        inFlight -= 1;
      };
    },
    idle: () => {
      void invalidate(CANVAS_LIST_DEPENDENCY).then(() => {
        if (!inFlight) {
          pages = null;
        }
      });
    },
    notice: (text) => {
      notice = text;
    }
  },
  restoreShell
);

export const canvasPages = {
  list(loaded: PageRow[]): PageRow[] {
    return pages ?? loaded;
  },
  token(canvasId: string, loaded: string | null): string | null {
    return share?.canvasId === canvasId ? share.token : loaded;
  },
  get notice(): string | null {
    return notice;
  },
  dismiss() {
    notice = null;
  },
  run<K extends PageAction>(action: K, input: Parameters<typeof pageOp<K>>[1], loaded: PageRow[], href: string): Promise<OpOutcome> {
    const route = canvasRouteOf(href);
    if (!route) {
      return Promise.resolve(OpOutcome.RolledBack);
    }
    base = pages ?? loaded;
    return run(runnablePage(pageOp(action, input), (op) => send(op, route.projectId)));
  }
};
