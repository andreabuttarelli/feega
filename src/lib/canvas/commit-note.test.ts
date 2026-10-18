import { describe, expect, it } from 'vitest';
import { adoptCommitted, commitHub, rowsOf, toCommitNote, type CommitNote } from './commit-note';

const tile = { id: 'n', version: 3, data: { prompt: 'a' }, saved: { prompt: 'a' }, x: 0, y: 0 };
const clean = () => [];
const unplaced = () => false;

describe('adoptCommitted', () => {
  it('takes a newer committed data row in place, without a refetch', () => {
    const out = adoptCommitted([tile], [{ id: 'n', version: 4, data: { prompt: 'b' } }], clean, unplaced);
    expect(out.tiles[0]).toMatchObject({ version: 4, data: { prompt: 'b' }, saved: { prompt: 'b' } });
    expect(out.refetch).toBe(false);
  });

  it('ignores an older version', () => {
    const out = adoptCommitted([tile], [{ id: 'n', version: 2, data: { prompt: 'old' } }], clean, unplaced);
    expect(out.tiles[0].data).toEqual({ prompt: 'a' });
  });

  it('keeps my unsent keys over the incoming row', () => {
    const mine = [{ ...tile, data: { prompt: 'typing' } }];
    const out = adoptCommitted(mine, [{ id: 'n', version: 4, data: { prompt: 'b', seed: 1 } }], () => ['prompt'], unplaced);
    expect(out.tiles[0].data).toEqual({ prompt: 'typing', seed: 1 });
    expect(out.tiles[0].saved).toEqual({ prompt: 'b', seed: 1 });
  });

  it('moves a node unless I have my own unsent move for it', () => {
    expect(adoptCommitted([tile], [{ id: 'n', x: 5, y: 6 }], clean, unplaced).tiles[0]).toMatchObject({ x: 5, y: 6 });
    expect(adoptCommitted([tile], [{ id: 'n', x: 5, y: 6 }], clean, () => true).tiles[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('asks for a refetch when the note names something it cannot apply', () => {
    expect(adoptCommitted([tile], [{ id: 'other', x: 1, y: 1 }], clean, unplaced).refetch).toBe(true);
    expect(adoptCommitted([tile], [], clean, unplaced).refetch).toBe(true);
  });
});

describe('toCommitNote', () => {
  it('rejects malformed notes', () => {
    expect(toCommitNote({ sessionId: 's', rows: [{ id: 'n', x: 'far' }] })).toBeNull();
    expect(toCommitNote({ sessionId: 's', rows: [{ id: 'n', x: 1, y: 2 }] })).toEqual({ sessionId: 's', rows: [{ id: 'n', x: 1, y: 2 }] });
  });
});

describe('rowsOf', () => {
  it('a data write carries the committed node', () => {
    expect(rowsOf('write', {}, { node: { id: 'n', version: 4, data: { a: 1 } } })).toEqual([{ id: 'n', version: 4, data: { a: 1 } }]);
  });

  it('a move carries the position it asked for', () => {
    expect(rowsOf('move', { node_id: 'n', x: 3, y: 4 }, {})).toEqual([{ id: 'n', x: 3, y: 4 }]);
  });

  it('any other action is a bare nudge', () => {
    expect(rowsOf('delete', { node_id: 'n' }, {})).toEqual([]);
  });

  it('reads are never announced', () => {
    expect(rowsOf('snapshot', {}, {})).toBeNull();
  });
});

describe('commitHub', () => {
  it('publishes with my session and hears only others', () => {
    const hub = commitHub('me');
    const sent: unknown[] = [];
    const heard: CommitNote[] = [];
    hub.line.attach((note) => sent.push(note));
    hub.listen((note) => heard.push(note));
    hub.publish([{ id: 'n', x: 1, y: 1 }]);
    expect(sent).toEqual([{ sessionId: 'me', rows: [{ id: 'n', x: 1, y: 1 }] }]);
    hub.line.receive({ sessionId: 'me', rows: [] });
    hub.line.receive({ sessionId: 'bo', rows: [] });
    expect(heard.map((n) => n.sessionId)).toEqual(['bo']);
  });
});
