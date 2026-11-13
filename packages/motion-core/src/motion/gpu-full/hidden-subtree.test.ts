import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { drawFrame, prepare } from './display-list';

const rect = (x: number) => ({ shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#ff6a3d' }] });

type Node = { id: string; x: number; parent?: string; hidden?: boolean };

function family(nodes: Node[]): MotionDoc {
  const doc = nodes.reduce((d, n) => {
    const next = addClip(d, { component: 'Shape', from: 0, durationInFrames: 30, props: rect(n.x) }, n.id);
    if (!next.ok) {
      throw new Error(next.error);
    }
    return next.doc;
  }, { ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 } as MotionDoc);
  const by = new Map(nodes.map((n) => [n.id, n]));
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, parent: by.get(c.id)?.parent ?? c.parent, hidden: by.get(c.id)?.hidden })) })) } as MotionDoc;
}

const drawnClips = (doc: MotionDoc) => [...new Set(drawFrame(prepare(doc, FEEGA_TOKENS), 0).items.map((i) => i.clip))].sort();

describe('hiding a frame', () => {
  it('hides its child', () => {
    expect(drawnClips(family([{ id: 'card', x: 0.5, hidden: true }, { id: 'dot', x: 0.6, parent: 'card' }]))).toEqual([]);
  });

  it('hides its grandchild', () => {
    expect(drawnClips(family([{ id: 'card', x: 0.5, hidden: true }, { id: 'dot', x: 0.6, parent: 'card' }, { id: 'spark', x: 0.7, parent: 'dot' }]))).toEqual([]);
  });

  it('keeps a shown parent when only the child is hidden', () => {
    expect(drawnClips(family([{ id: 'card', x: 0.5 }, { id: 'dot', x: 0.6, parent: 'card', hidden: true }]))).toEqual(['card']);
  });
});
