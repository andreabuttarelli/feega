import { describe, expect, it } from 'vitest';
import { planDuplicate, DUPLICATE_OFFSET, offsetFrom, dragOffset, repeatOffset } from './duplicate-plan';

const node = (id: string, type: string, data: Record<string, unknown>, x = 0, y = 0) => ({ id, type, data, x, y });
const edge = (id: string, source: string, target: string, sourceHandle: string | null = null, targetHandle: string | null = null) => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle
});

describe('cosa nasce da un duplica', () => {
  it('copia le tile scelte, spostate del passo dato', () => {
    const plan = planDuplicate({
      ids: ['a'],
      nodes: [node('a', 'text', { prompt: 'ciao' }, 100, 200)],
      edges: [],
      offset: DUPLICATE_OFFSET
    });

    expect(plan.nodes).toEqual([
      { sourceIndex: 0, type: 'text', data: { prompt: 'ciao' }, x: 132, y: 232 }
    ]);
  });

  it('porta con sé le linee interamente dentro la selezione', () => {
    const plan = planDuplicate({
      ids: ['a', 'b'],
      nodes: [node('a', 'text', {}), node('b', 'image', {})],
      edges: [edge('e1', 'a', 'b', 'text', 'text')],
      offset: DUPLICATE_OFFSET
    });

    expect(plan.edges).toEqual([{ sourceIndex: 0, targetIndex: 1, sourceHandle: 'text', targetHandle: 'text' }]);
  });

  it('lascia stare una linea con un solo capo dentro la selezione', () => {
    const plan = planDuplicate({
      ids: ['a'],
      nodes: [node('a', 'text', {}), node('b', 'image', {})],
      edges: [edge('e1', 'a', 'b')],
      offset: DUPLICATE_OFFSET
    });

    expect(plan.edges).toEqual([]);
  });

  it('toglie lo stato di corsa, non la configurazione', () => {
    const plan = planDuplicate({
      ids: ['a'],
      nodes: [node('a', 'image', { prompt: 'gatto', model: 'x', running: true, error: 'boom', refId: 'asset-1' })],
      edges: [],
      offset: DUPLICATE_OFFSET
    });

    expect(plan.nodes[0].data).toEqual({ prompt: 'gatto', model: 'x' });
  });

  it('non duplica quel che non è selezionato', () => {
    const plan = planDuplicate({
      ids: ['a'],
      nodes: [node('a', 'text', {}), node('b', 'text', {})],
      edges: [],
      offset: DUPLICATE_OFFSET
    });

    expect(plan.nodes).toHaveLength(1);
  });

  it('una selezione vuota non produce niente', () => {
    const plan = planDuplicate({ ids: [], nodes: [], edges: [], offset: DUPLICATE_OFFSET });

    expect(plan.nodes).toEqual([]);
    expect(plan.edges).toEqual([]);
  });
});

describe('offsetFrom', () => {
  it('reads a dragged offset', () => {
    expect(offsetFrom('300', '-5')).toEqual({ dx: 300, dy: -5 });
  });

  it('falls back to the small step when nothing or garbage arrives', () => {
    expect(offsetFrom(null, null)).toBeUndefined();
    expect(offsetFrom('x', '1')).toBeUndefined();
  });
});

describe('dragOffset', () => {
  it('is how far the grabbed tile travelled from where the drag began', () => {
    const origin = new Map([['a', { x: 10, y: 10 }]]);
    expect(dragOffset(origin, { id: 'a', position: { x: 110, y: 60 } })).toEqual({ dx: 100, dy: 50 });
  });

  it('is nothing for a tile the drag never started from', () => {
    expect(dragOffset(new Map(), { id: 'a', position: { x: 1, y: 1 } })).toBeUndefined();
  });
});

describe('repeatOffset', () => {
  const last = { ids: ['c1', 'c2'], offset: { dx: 200, dy: 0 } };

  it('repeats the last step when the copies just made are duplicated again', () => {
    expect(repeatOffset(last, ['c2', 'c1'])).toEqual({ dx: 200, dy: 0 });
  });

  it('uses the small step for any other selection', () => {
    expect(repeatOffset(last, ['c1'])).toBeUndefined();
    expect(repeatOffset(null, ['c1', 'c2'])).toBeUndefined();
  });
});
