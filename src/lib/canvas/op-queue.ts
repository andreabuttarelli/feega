import { SendResult } from './save-scheduler';

export type Op = { opId: string; action: string; fields: Record<string, string> };

export type OpStore = { save: (ops: Op[]) => void };

type OpQueueOptions = {
  send: (op: Op) => Promise<SendResult>;
  store: OpStore;
  backoffMs: (failures: number) => number;
  onDropped: (op: Op) => void;
  onSize?: (size: number) => void;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createOpQueue(options: OpQueueOptions) {
  const ops: Op[] = [];
  let running: Promise<void> | null = null;

  function persist() {
    options.store.save([...ops]);
    options.onSize?.(ops.length);
  }

  async function sendHead(op: Op) {
    let failures = 0;
    for (;;) {
      const result = await options.send(op).catch(() => SendResult.Retry);
      if (result !== SendResult.Retry) {
        return result;
      }
      failures += 1;
      await pause(options.backoffMs(failures));
    }
  }

  async function run() {
    while (ops.length) {
      const head = ops[0];
      const result = await sendHead(head);
      ops.shift();
      persist();
      if (result === SendResult.Dropped) {
        options.onDropped(head);
      }
    }
  }

  function drain(): Promise<void> {
    running ??= run().finally(() => { running = null; });
    return running;
  }

  function push(op: Op) {
    ops.push(op);
    persist();
    void drain();
  }

  function restore(older: Op[]) {
    const known = new Set(ops.map((op) => op.opId));
    const fresh = older.filter((op) => !known.has(op.opId));
    ops.splice(running ? 1 : 0, 0, ...fresh);
    persist();
    void drain();
  }

  return { push, restore, drain, size: () => ops.length, pending: () => [...ops] };
}

export enum LineAction {
  Connect = 'connect',
  Disconnect = 'disconnect'
}

const linesOf = (ops: Op[], action: LineAction) => new Set(ops.filter((op) => op.action === action).map((op) => op.fields.connection_id));

export function keepLines<T extends { id: string }>(fresh: T[], local: T[], pending: Op[]): T[] {
  const added = linesOf(pending, LineAction.Connect);
  const removed = linesOf(pending, LineAction.Disconnect);
  const shown = fresh.filter((line) => !removed.has(line.id));
  const known = new Set(shown.map((line) => line.id));
  return [...shown, ...local.filter((line) => added.has(line.id) && !known.has(line.id) && !removed.has(line.id))];
}
