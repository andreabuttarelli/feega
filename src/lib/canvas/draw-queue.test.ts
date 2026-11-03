import { describe, expect, it } from 'vitest';
import { DrawAction, drawOp, drawnIds, keepDrawn } from './draw-queue';

const tile = (id: string, x = 0) => ({ id, x });

describe('draws: a shape drawn offline stays on the canvas until it lands', () => {
  it('names the drawn node in the op, so a replay can be recognised by the server', () => {
    expect(drawOp(DrawAction.Element, 'n1', { drawn: '{}' })).toEqual({ opId: 'n1', action: 'drawElement', fields: { drawn: '{}', node_id: 'n1' } });
  });

  it('a snapshot without the node keeps the local tile while its draw is waiting', () => {
    const pending = [drawOp(DrawAction.Element, 'ghost', { drawn: '{}' })];

    expect(keepDrawn([tile('a')], [tile('a'), tile('ghost'), tile('gone')], pending)).toEqual([tile('a'), tile('ghost')]);
  });

  it('a snapshot that has the node wins over the local tile', () => {
    const pending = [drawOp(DrawAction.Frame, 'f', { box: '{}' })];

    expect(keepDrawn([tile('f', 9)], [tile('f', 1)], pending)).toEqual([tile('f', 9)]);
  });

  it('lists the ids still waiting to be drawn', () => {
    expect([...drawnIds([drawOp(DrawAction.Element, 'a', {}), drawOp(DrawAction.Frame, 'b', {})])]).toEqual(['a', 'b']);
  });
});
