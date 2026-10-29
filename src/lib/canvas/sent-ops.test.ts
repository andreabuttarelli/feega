import { describe, expect, it } from 'vitest';
import { replaySent, sentLog, type SentOp } from './sent-ops';

const op = (id: string): SentOp => ({ id, action: 'rename', fields: { node_id: id, name: id } });

describe('sent ops: a write the server has not answered survives a reload', () => {
  it('keeps every op from the gesture until its answer, and saves each change', () => {
    const saved: SentOp[][] = [];
    const log = sentLog([], (ops) => saved.push(ops));

    log.add(op('a'));
    log.add(op('b'));
    log.drop('a');

    expect(log.all()).toEqual([op('b')]);
    expect(saved.map((ops) => ops.map((o) => o.id))).toEqual([['a'], ['a', 'b'], ['b']]);
  });

  it('after a reload sends what was left, in the order it was made, and only that', async () => {
    const posted: string[] = [];
    const log = sentLog([op('a'), op('b'), op('new')], () => {});

    await replaySent(log, [op('a'), op('b')], async (action, fields) => {
      posted.push(`${action}:${fields.node_id}`);
      return {};
    });

    expect(posted).toEqual(['rename:a', 'rename:b']);
    expect(log.all()).toEqual([op('new')]);
  });
});
