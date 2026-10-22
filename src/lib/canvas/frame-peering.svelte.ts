import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
import type { FrameRect } from '$lib/motion/gpu/pick';
import { keepMark, peersIn, type FrameCursor, type FrameMark, type FramePeer, type FramePresence } from '$lib/realtime/frame-presence';

export const CURSOR_SEND_MS = 60;
export const PRESENCE_BEAT_MS = 3000;

type Mine = { nodeId: string | null; cursor: FrameCursor | null; selection: string[] };

const NOWHERE: Mine = { nodeId: null, cursor: null, selection: [] };

export class FramePeering {
  marks = $state.raw(new Map<string, FrameMark>());
  clock = $state(Date.now());

  private readonly presence: FramePresence;
  private mine: Mine = NOWHERE;
  private sentAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(presence: FramePresence) {
    this.presence = presence;
  }

  start(): () => void {
    const stop = this.presence.listen((mark) => (this.marks = keepMark(this.marks, mark)));
    const beat = setInterval(() => {
      this.clock = Date.now();
      this.send();
    }, PRESENCE_BEAT_MS);
    return () => {
      stop();
      clearInterval(beat);
      clearTimeout(this.timer ?? undefined);
      this.timer = null;
      this.mine = NOWHERE;
      this.send();
    };
  }

  peersOf(nodeId: string, onCanvas: ReadonlySet<string>): FramePeer[] {
    return peersIn(this.marks, nodeId, this.presence.self.userId, this.clock).map((p) => (onCanvas.has(p.userId) ? { ...p, cursor: null } : p));
  }

  point(nodeId: string | null, cursor: FrameCursor | null, selection: readonly string[]) {
    this.mine = { nodeId, cursor, selection: [...selection] };
    if (this.timer) {
      return;
    }
    const wait = Math.max(0, this.sentAt + CURSOR_SEND_MS - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.send();
    }, wait);
  }

  select(nodeId: string | null, selection: readonly string[]) {
    this.point(nodeId, nodeId === this.mine.nodeId ? this.mine.cursor : null, selection);
  }

  private send() {
    this.sentAt = Date.now();
    this.presence.send(this.mine);
  }
}

type FramePicker = { frameSize: () => { width: number; height: number }; frameRect: (clip: string) => FrameRect | null };

export function peerBoxes(picker: FramePicker, ids: readonly string[]): Record<string, MeasuredBox> {
  const { width, height } = picker.frameSize();
  return Object.fromEntries(
    ids.flatMap((id) => {
      const r = picker.frameRect(id);
      return r ? [[id, { left: r.left / width, top: r.top / height, width: r.width / width, height: r.height / height }]] : [];
    })
  );
}
