import { inOrder } from './optimistic-group';
import type { UndoItem } from './undo-plan';

export enum OpOutcome {
  Landed = 'landed',
  RolledBack = 'rolled-back'
}

export type Touched = { nodes: readonly string[]; edges: readonly string[] };

export type OptimisticOp<S, A, T = Touched> = {
  apply: (state: S) => S;
  touched: T;
  send: () => Promise<A | null>;
  undo: (answer: A) => UndoItem[];
  settle?: (state: S, answer: A) => S;
  notice: string;
};

export type OptimisticPort<S> = {
  read: () => S;
  write: (state: S) => void;
  reserve: () => (items: UndoItem[] | null) => void;
  hold: () => () => void;
  idle: () => void;
  notice: (text: string) => void;
};

export type Restore<S, T = Touched> = (current: S, before: S, touched: T) => S;

export function restoreRows<T extends { id: string }>(current: readonly T[], before: readonly T[], ids: readonly string[]): T[] {
  const touched = new Set(ids);
  const rows = current.filter((row) => !touched.has(row.id));
  before.forEach((row, at) => {
    if (touched.has(row.id)) {
      rows.splice(Math.min(at, rows.length), 0, row);
    }
  });
  return rows;
}

export function createOptimistic<S, T = Touched>(port: OptimisticPort<S>, restore: Restore<S, T>) {
  const queue = inOrder();
  let inFlight = 0;

  async function land<A>(op: OptimisticOp<S, A, T>, before: S, reserved: (items: UndoItem[] | null) => void): Promise<OpOutcome> {
    const answer = await op.send().catch(() => null);
    if (answer === null) {
      reserved(null);
      port.write(restore(port.read(), before, op.touched));
      port.notice(op.notice);
      return OpOutcome.RolledBack;
    }

    const items = op.undo(answer);
    reserved(items.length ? items : null);
    if (op.settle) {
      port.write(op.settle(port.read(), answer));
    }
    return OpOutcome.Landed;
  }

  return function run<A>(op: OptimisticOp<S, A, T>): Promise<OpOutcome> {
    const before = port.read();
    port.write(op.apply(before));
    const reserved = port.reserve();
    const release = port.hold();
    inFlight += 1;

    return queue(() => land(op, before, reserved)).finally(() => {
      release();
      inFlight -= 1;
      if (!inFlight) {
        port.idle();
      }
    });
  };
}
