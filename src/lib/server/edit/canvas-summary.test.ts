import { describe, it, expect } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { summarizeCanvas, elementsOf, detailOf } from './canvas-summary';

const frameDoc = (): MotionDoc => ({
  ...newMotionDoc(MotionFormat.Portrait),
  tracks: [{ id: 't1', name: 'Layers', kind: 'visual', clips: [{ id: 'c1', component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.5, height: 0.2 } }] } as never]
});

const node = (over: Record<string, unknown>) => ({ id: 'n', canvasId: 'c', projectId: 'p', type: 'text', displayName: null, position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, data: {}, version: 1, ...over }) as never;

describe('the canvas in one outline', () => {
  it('lists every node with title, place, size, wiring and last run status', () => {
    const out = summarizeCanvas({
      canvasId: 'c',
      nodes: [node({ id: 'a', displayName: 'Brief', position: { x: 5, y: 6, z: 0 }, size: { width: 100, height: 50 } }), node({ id: 'b', type: 'image' })],
      connections: [{ id: 'e1', canvasId: 'c', sourceNodeId: 'a', targetNodeId: 'b', sourceHandle: null, targetHandle: null, mode: 'fixed' } as never],
      runs: { a: [{ status: 'done' }, { status: 'running' }] as never },
      docs: new Map()
    });

    expect(out.nodes[0]).toMatchObject({ id: 'a', type: 'text', title: 'Brief', x: 5, y: 6, width: 100, height: 50, run: 'running', outputs: ['b'], inputs: [] });
    expect(out.nodes[1]).toMatchObject({ id: 'b', inputs: ['a'], run: null });
    expect(out.connections).toEqual([{ id: 'e1', from: 'a', to: 'b' }]);
  });

  it('a frame carries the tree of its elements with kind, name, bounds and text', () => {
    const out = summarizeCanvas({ canvasId: 'c', nodes: [node({ id: 'f', type: 'motion', displayName: 'Poster' })], connections: [], runs: {}, docs: new Map([['f', frameDoc()]]) });

    expect(out.nodes[0].elements).toEqual([{ id: 'c1', kind: 'Title', name: 'Title', bounds: { left: 270, top: 540, width: 540, height: 270 }, text: 'Hello', start: 0, duration: 2 }]);
    expect(out.nodes[0].frame).toMatchObject({ width: 1080, height: 1350 });
  });

  it('elementsOf and detailOf find one element of a frame', () => {
    expect(elementsOf(frameDoc())).toHaveLength(1);
    expect(detailOf(frameDoc(), 'c1')).toMatchObject({ id: 'c1', component: 'Title', props: { text: 'Hello' } });
    expect(detailOf(frameDoc(), 'zz')).toBeNull();
  });
});
