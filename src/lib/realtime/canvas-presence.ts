import { z } from 'zod';
import { Plan, hzFor } from './broadcast-budget';
import { MARK_STALE_MS, colourOf, type FrameCursor } from './frame-presence';

export const CANVAS_PEER_EVENT = 'canvas-peer';
export const TICK_MS = 33;
export const HEARTBEAT_MS = 3000;
export const SETTLE_MS = 3000;
export const CHAT_MAX = 120;
const MS_PER_SECOND = 1000;
const MAX_SELECTION = 200;

export type View = { cx: number; cy: number; zoom: number };

export type LiveBox = { id: string; x: number; y: number; w?: number; h?: number; r?: number };

export type CanvasMark = { sessionId: string; userId: string; name: string; cursor: FrameCursor | null; selection: string[]; live: LiveBox[]; view: View | null; presenting: boolean; chat: string | null; at: number };

export type CanvasSelf = Pick<CanvasMark, 'sessionId' | 'userId' | 'name'>;

export type CanvasState = Pick<CanvasMark, 'cursor' | 'selection' | 'live' | 'view' | 'presenting' | 'chat'>;

export type CanvasPeer = CanvasMark & { colour: string };

type Dropped = LiveBox & { until: number };

export type HeldMark = CanvasMark & { dropped?: Dropped[] };

export type CanvasLine = { receive: (payload: unknown) => void; attach: (send: ((mark: CanvasMark) => void) | null) => void };

export type CanvasPresence = {
  update: (state: Partial<CanvasState>) => void;
  listen: (on: (mark: CanvasMark, sentAt: number) => void) => () => void;
  crowd: (peers: number) => void;
  stop: () => void;
};

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

const markSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  cursor: point.nullable(),
  selection: z.array(z.string()).max(MAX_SELECTION),
  live: z.array(z.object({ id: z.string().min(1), x: z.number().finite(), y: z.number().finite(), w: z.number().finite().positive().optional(), h: z.number().finite().positive().optional(), r: z.number().finite().optional() })).max(MAX_SELECTION).default([]),
  view: z.object({ cx: z.number().finite(), cy: z.number().finite(), zoom: z.number().finite().positive() }).nullable().default(null),
  presenting: z.boolean().default(false),
  chat: z.string().max(CHAT_MAX).nullable().default(null),
  at: z.number().finite()
});

export function toCanvasMark(raw: unknown): CanvasMark | null {
  const parsed = markSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function keepCanvasMark(marks: Map<string, HeldMark>, mark: CanvasMark): Map<string, HeldMark> {
  const seen = marks.get(mark.sessionId);
  if (seen && seen.at > mark.at) {
    return marks;
  }
  const moving = new Set(mark.live.map((box) => box.id));
  const released = (seen?.live ?? []).filter((box) => !moving.has(box.id)).map((box) => ({ ...box, until: mark.at + SETTLE_MS }));
  const dropped = [...(seen?.dropped ?? []).filter((box) => !moving.has(box.id) && box.until >= mark.at), ...released];
  return new Map(marks).set(mark.sessionId, { ...mark, dropped });
}

export function canvasPeersOf(marks: Map<string, HeldMark>, selfSession: string, now: number, landed: (box: LiveBox) => boolean = () => false): CanvasPeer[] {
  return [...marks.values()]
    .filter((m) => m.sessionId !== selfSession && now - m.at <= MARK_STALE_MS)
    .map(({ dropped = [], ...m }) => {
      const settling = dropped.filter((box) => now <= box.until && !landed(box)).map(({ until: _until, ...box }) => box);
      return { ...m, live: [...m.live, ...settling], colour: colourOf(m.userId) };
    });
}

const LANDED_PX = 1;

type Placed = { id: string; x: number; y: number; w: number; h: number; rotation?: number };

const near = (a: number, b: number | undefined) => b === undefined || Math.abs(a - b) < LANDED_PX;

export function landedAt(rect: Omit<Placed, 'id'>, box: LiveBox): boolean {
  return near(rect.x, box.x) && near(rect.y, box.y) && near(rect.w, box.w) && near(rect.h, box.h) && near(rect.rotation ?? 0, box.r);
}

export function withPeerMotion<T extends Placed>(tiles: T[], peers: CanvasPeer[], mine: Set<string>): T[] {
  const moving = new Map(peers.flatMap((peer) => peer.live).filter((box) => !mine.has(box.id)).map((box) => [box.id, box]));
  if (!moving.size) {
    return tiles;
  }
  return tiles.map((tile) => {
    const box = moving.get(tile.id);
    return box ? { ...tile, x: box.x, y: box.y, w: box.w ?? tile.w, h: box.h ?? tile.h, rotation: box.r ?? tile.rotation } : tile;
  });
}

export function centreOf(viewport: { x: number; y: number; zoom: number }, size: { width: number; height: number }): View {
  return { cx: (size.width / 2 - viewport.x) / viewport.zoom, cy: (size.height / 2 - viewport.y) / viewport.zoom, zoom: viewport.zoom };
}

export function followed(peers: CanvasPeer[], userId: string): View | null {
  const latest = peers.filter((p) => p.userId === userId && p.view).sort((a, b) => b.at - a.at)[0];
  return latest?.view ?? null;
}

export function presenterOf(peers: CanvasPeer[]): CanvasPeer | null {
  return peers.find((p) => p.presenting) ?? null;
}

export function canvasHub(self: CanvasSelf, now: () => number = Date.now): { port: CanvasPresence; line: CanvasLine } {
  const listeners = new Set<(mark: CanvasMark, sentAt: number) => void>();
  let transmit: ((mark: CanvasMark) => void) | null = null;
  let state: CanvasState = { cursor: null, selection: [], live: [], view: null, presenting: false, chat: null };
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
  let tickMs = TICK_MS;

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
    crowd: (peers) => {
      tickMs = Math.max(TICK_MS, Math.round(MS_PER_SECOND / hzFor(peers, Plan.Pro)));
      if (timer) {
        halt();
        timer = setInterval(tick, tickMs);
      }
    },
    stop: halt
  };

  const line: CanvasLine = {
    attach: (send) => {
      transmit = send;
      halt();
      if (send) {
        dirty = true;
        timer = setInterval(tick, tickMs);
      }
    },
    receive: (raw) => {
      const mark = toCanvasMark(raw);
      if (mark) {
        listeners.forEach((on) => on({ ...mark, at: now() }, mark.at));
      }
    }
  };

  return { port, line };
}
