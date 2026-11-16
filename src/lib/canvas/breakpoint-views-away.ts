import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { ResolveViews } from './breakpoint-views';

type Answer = { id: number; docs?: MotionDoc[]; error?: string };

type Waiting = { done: (docs: MotionDoc[]) => void; fail: (err: unknown) => void };

export type ViewsWorker = {
  postMessage: (ask: { id: number; doc: MotionDoc; breakpointIds: string[] }) => void;
  onmessage: ((e: MessageEvent<Answer>) => void) | null;
  terminate: () => void;
};

export function viewsAway(spawn: () => ViewsWorker | null): ResolveViews & { stop: () => void } {
  let worker: ViewsWorker | null = null;
  let next = 0;
  const waiting = new Map<number, Waiting>();

  const answered = ({ data }: MessageEvent<Answer>) => {
    const wait = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.docs) {
      wait?.done(data.docs);
      return;
    }
    wait?.fail(new Error(data.error));
  };

  const started = () => {
    if (worker) {
      return worker;
    }
    worker = spawn();
    if (worker) {
      worker.onmessage = answered;
    }
    return worker;
  };

  const resolve: ResolveViews = (doc, breakpointIds) =>
    new Promise((done, fail) => {
      const away = started();
      if (!away) {
        fail(new Error('no views worker'));
        return;
      }
      const id = ++next;
      waiting.set(id, { done, fail });
      try {
        away.postMessage({ id, doc, breakpointIds });
      } catch (err) {
        waiting.delete(id);
        fail(err);
      }
    });

  const stop = () => {
    worker?.terminate();
    worker = null;
    waiting.forEach((w) => w.fail(new Error('views worker stopped')));
    waiting.clear();
  };

  return Object.assign(resolve, { stop });
}
