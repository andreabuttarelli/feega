import { getContext, setContext } from 'svelte';
import { z } from 'zod';
import { opsSchema, type DocOp } from '$lib/motion/doc-ops';
import type { PeerStep } from '$lib/motion/frame-step';

export type FrameCursor = { x: number; y: number };

export type FrameMark = { userId: string; name: string; nodeId: string | null; cursor: FrameCursor | null; selection: string[]; at: number };

export type FramePeer = FrameMark & { colour: string };

export type FrameSelf = { userId: string; name: string };

export type FrameState = Pick<FrameMark, 'nodeId' | 'cursor' | 'selection'>;

export type FramePresence = {
  self: FrameSelf;
  send: (state: FrameState) => void;
  listen: (on: (mark: FrameMark) => void) => () => void;
  landed: (step: PeerStep) => void;
  onHead: (on: (step: PeerStep) => void) => () => void;
};

export const FRAME_EVENT = 'frame';
export const FRAME_HEAD_EVENT = 'frame-head';
export const MARK_STALE_MS = 10_000;
export const PEER_COLOURS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f', '#12a594', '#ffc53d'];

const markSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  nodeId: z.string().min(1).nullable(),
  cursor: z.object({ x: z.number().finite(), y: z.number().finite() }).nullable(),
  selection: z.array(z.string()).max(200),
  at: z.number().finite()
});

const stepSchema = z.object({ nodeId: z.string().min(1), base: z.number().int().min(0), version: z.number().int().min(1), ops: opsSchema });

export function toMark(raw: unknown): FrameMark | null {
  const parsed = markSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function colourOf(userId: string): string {
  const hash = [...userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return PEER_COLOURS[hash % PEER_COLOURS.length];
}

export function displayName(nameOrEmail: string): string {
  return nameOrEmail.split('@')[0] ?? nameOrEmail;
}

export function initialOf(nameOrEmail: string): string {
  return displayName(nameOrEmail).charAt(0).toUpperCase() || '?';
}

export function keepMark(marks: Map<string, FrameMark>, mark: FrameMark): Map<string, FrameMark> {
  const seen = marks.get(mark.userId);
  if (seen && seen.at > mark.at) {
    return marks;
  }
  return new Map(marks).set(mark.userId, mark);
}

export function peersIn(marks: Map<string, FrameMark>, nodeId: string, selfId: string, now: number): FramePeer[] {
  return [...marks.values()]
    .filter((m) => m.userId !== selfId && m.nodeId === nodeId && now - m.at <= MARK_STALE_MS)
    .map((m) => ({ ...m, colour: colourOf(m.userId) }));
}

export type FrameLine = { receive: (payload: unknown) => void; attach: (send: ((mark: FrameMark) => void) | null) => void };

export type HeadLine = { receive: (payload: unknown) => void; attach: (send: ((step: PeerStep) => void) | null) => void };

export function frameHub(self: FrameSelf, now: () => number = Date.now): { port: FramePresence; line: FrameLine; heads: HeadLine } {
  const listeners = new Set<(mark: FrameMark) => void>();
  const headListeners = new Set<(step: PeerStep) => void>();
  let transmit: ((mark: FrameMark) => void) | null = null;
  let announce: ((step: PeerStep) => void) | null = null;

  const port: FramePresence = {
    self,
    send: (state) => transmit?.({ ...self, ...state, at: now() }),
    listen: (on) => {
      listeners.add(on);
      return () => listeners.delete(on);
    },
    landed: (step) => announce?.(step),
    onHead: (on) => {
      headListeners.add(on);
      return () => headListeners.delete(on);
    }
  };
  const heads: HeadLine = {
    attach: (send) => {
      announce = send;
    },
    receive: (raw) => {
      const parsed = stepSchema.safeParse(raw);
      if (parsed.success) {
        const step = { ...parsed.data, ops: parsed.data.ops as DocOp[] };
        headListeners.forEach((on) => on(step));
      }
    }
  };
  const line: FrameLine = {
    attach: (send) => {
      transmit = send;
    },
    receive: (raw) => {
      const mark = toMark(raw);
      if (mark) {
        listeners.forEach((on) => on({ ...mark, at: now() }));
      }
    }
  };
  return { port, line, heads };
}

const CONTEXT = Symbol('frame-presence');

export function provideFramePresence(port: FramePresence): void {
  setContext(CONTEXT, port);
}

export function framePresence(): FramePresence | null {
  return getContext<FramePresence | undefined>(CONTEXT) ?? null;
}
