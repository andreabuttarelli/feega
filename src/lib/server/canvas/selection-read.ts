import { toCanvasMark, type CanvasMark } from '$lib/realtime/canvas-presence';

export const NO_OPEN_SESSION = 'no_open_session';
export const SELECTION_WAIT_MS = 3500;
const SETTLE_MS = 20;

export type MarkFeed = (canvasId: string, on: (payload: unknown) => void) => Promise<() => void>;

type Session = Pick<CanvasMark, 'sessionId' | 'selection' | 'view' | 'at'>;

export type SelectionAnswer = { sessions: Session[]; reason?: typeof NO_OPEN_SESSION };

type Ask = { canvasId: string; userId: string; waitMs: number };

export async function readSelection(feed: MarkFeed, ask: Ask): Promise<SelectionAnswer> {
  const seen = new Map<string, Session>();
  let settling: ReturnType<typeof setTimeout> | null = null;
  let stop: () => void = () => {};

  const finished = new Promise<void>((resolve) => {
    const deadline = setTimeout(resolve, ask.waitMs);
    stop = () => {
      clearTimeout(deadline);
      resolve();
    };
  });

  const onMark = (payload: unknown) => {
    const mark = toCanvasMark(payload);
    if (!mark || mark.userId !== ask.userId) {
      return;
    }

    const held = seen.get(mark.sessionId);
    if (!held || held.at < mark.at) {
      seen.set(mark.sessionId, { sessionId: mark.sessionId, selection: mark.selection, view: mark.view, at: mark.at });
    }
    settling ??= setTimeout(stop, SETTLE_MS);
  };

  const leave = await feed(ask.canvasId, onMark).catch(() => null);
  if (!leave) {
    stop();
  }
  await finished;
  if (settling) {
    clearTimeout(settling);
  }
  leave?.();

  const sessions = [...seen.values()];
  return sessions.length ? { sessions } : { sessions, reason: NO_OPEN_SESSION };
}
