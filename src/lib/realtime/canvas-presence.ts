import { z } from 'zod';
import { MARK_STALE_MS, colourOf, type FrameCursor } from './frame-presence';

export const CANVAS_PEER_EVENT = 'canvas-peer';
export const TICK_MS = 50;
export const HEARTBEAT_MS = 3000;
const MAX_SELECTION = 200;

export type CanvasMark = { sessionId: string; userId: string; name: string; cursor: FrameCursor | null; selection: string[]; at: number };

export type CanvasSelf = Pick<CanvasMark, 'sessionId' | 'userId' | 'name'>;

export type CanvasState = Pick<CanvasMark, 'cursor' | 'selection'>;

export type CanvasPeer = CanvasMark & { colour: string };

export type CanvasLine = { receive: (payload: unknown) => void; attach: (send: ((mark: CanvasMark) => void) | null) => void };

export type CanvasPresence = {
  update: (state: Partial<CanvasState>) => void;
  listen: (on: (mark: CanvasMark) => void) => () => void;
  stop: () => void;
};

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

const markSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  cursor: point.nullable(),
  selection: z.array(z.string()).max(MAX_SELECTION),
  at: z.number().finite()
});

export function toCanvasMark(raw: unknown): CanvasMark | null {
  const parsed = markSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function keepCanvasMark(marks: Map<string, CanvasMark>, mark: CanvasMark): Map<string, CanvasMark> {
  const seen = marks.get(mark.sessionId);
  if (seen && seen.at > mark.at) {
    return marks;
  }
  return new Map(marks).set(mark.sessionId, mark);
}

export function canvasPeersOf(marks: Map<string, CanvasMark>, selfSession: string, now: number): CanvasPeer[] {
  return [...marks.values()]
    .filter((m) => m.sessionId !== selfSession && now - m.at <= MARK_STALE_MS)
    .map((m) => ({ ...m, colour: colourOf(m.userId) }));
}

export function canvasHub(self: CanvasSelf, now: () => number = Date.now): { port: CanvasPresence; line: CanvasLine } {
  const listeners = new Set<(mark: CanvasMark) => void>();
  let transmit: ((mark: CanvasMark) => void) | null = null;
  let state: CanvasState = { cursor: null, selection: [] };
  let dirty = false;
  let lastSent = 0;

  function tick() {
    const due = dirty || (lastSent > 0 && now() - lastSent >= HEARTBEAT_MS);
    if (!due) {
      return;
    }
    dirty = false;
    lastSent = now();
    transmit?.({ ...self, ...state, at: lastSent });
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  function halt() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  const port: CanvasPresence = {
    update: (next) => {
      state = { ...state, ...next };
      dirty = true;
    },
    listen: (on) => {
      listeners.add(on);
      return () => listeners.delete(on);
    },
    stop: halt
  };

  const line: CanvasLine = {
    attach: (send) => {
      transmit = send;
      halt();
      if (send) {
        dirty = true;
        timer = setInterval(tick, TICK_MS);
      }
    },
    receive: (raw) => {
      const mark = toCanvasMark(raw);
      if (mark) {
        listeners.forEach((on) => on({ ...mark, at: now() }));
      }
    }
  };

  return { port, line };
}
