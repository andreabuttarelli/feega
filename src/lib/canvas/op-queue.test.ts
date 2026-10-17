import { describe, expect, it, vi } from 'vitest';
import { createOpQueue, keepLines, type Op } from './op-queue';
import { SendResult } from './save-scheduler';

function harness(results: SendResult[]) {
  const sent: Op[] = [];
  const saved: Op[][] = [];
  const dropped: Op[] = [];
  const queue = createOpQueue({
    send: vi.fn(async (op: Op) => {
      sent.push(op);
      return results.shift() ?? SendResult.Saved;
    }),
    store: { save: (ops) => { saved.push(ops); } },
    backoffMs: () => 0,
    onDropped: (op) => dropped.push(op)
  });
  return { queue, sent, saved, dropped };
}

const op = (opId: string, action = 'connect'): Op => ({ opId, action, fields: { connection_id: opId } });

describe('op queue: line operations land in order, once, and survive a reload', () => {
  it('sends in the order they were made, one at a time', async () => {
    const { queue, sent } = harness([]);

    queue.push(op('1'));
    queue.push(op('2', 'disconnect'));
    await queue.drain();

    expect(sent.map((o) => o.opId)).toEqual(['1', '2']);
  });

  it('retries a transient failure with the same op id before moving on', async () => {
    const { queue, sent } = harness([SendResult.Retry]);

    queue.push(op('1'));
    queue.push(op('2'));
    await queue.drain();

    expect(sent.map((o) => o.opId)).toEqual(['1', '1', '2']);
  });

  it('drops a refused op, tells the caller, and continues', async () => {
    const { queue, sent, dropped } = harness([SendResult.Dropped]);

    queue.push(op('1'));
    queue.push(op('2'));
    await queue.drain();

    expect(dropped.map((o) => o.opId)).toEqual(['1']);
    expect(sent.map((o) => o.opId)).toEqual(['1', '2']);
  });

  it('stores what is unsent and replays it on the next open', async () => {
    const first = harness([SendResult.Retry, SendResult.Retry]);
    first.queue.push(op('1'));
    expect(first.saved.at(-1)?.map((o) => o.opId)).toEqual(['1']);

    const reopened = harness([]);
    reopened.queue.push(op('2'));
    reopened.queue.restore([op('1')]);
    await reopened.queue.drain();

    expect(reopened.sent.map((o) => o.opId)).toEqual(['2', '1']);
    expect(reopened.saved.at(-1)).toEqual([]);
  });

  it('counts what is still unsent', () => {
    const { queue } = harness([SendResult.Retry]);
    queue.push(op('1'));
    expect(queue.size()).toBe(1);
  });
});

describe('keepLines: a resync shows lines as the user left them', () => {
  const fresh = [{ id: 'kept' }, { id: 'unlinked' }];
  const local = [{ id: 'kept' }, { id: 'new' }];
  const pending: Op[] = [
    { opId: 'o1', action: 'connect', fields: { connection_id: 'new' } },
    { opId: 'o2', action: 'disconnect', fields: { connection_id: 'unlinked' } }
  ];

  it('keeps an unsent new line and hides a line whose removal is unsent', () => {
    expect(keepLines(fresh, local, pending).map((l) => l.id)).toEqual(['kept', 'new']);
  });

  it('takes the server lines when nothing is pending', () => {
    expect(keepLines(fresh, local, [])).toEqual(fresh);
  });
});
