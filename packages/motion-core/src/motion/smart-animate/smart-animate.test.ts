import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { Ease } from '../design';
import { LayerRole, smartAnimate, type AnimatedLayer } from './smart-animate';

const named = (doc: MotionDoc, id: string, name?: string): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, name } : c)) })) });

function frameOf(layers: { id: string; name?: string; props: Record<string, unknown> }[]): MotionDoc {
  return layers.reduce((doc, layer) => {
    const added = addClip(doc, { component: 'Shape', props: layer.props, from: 0, durationInFrames: 30 }, layer.id);
    if (!added.ok) {
      throw new Error(added.error);
    }
    return named(added.doc, layer.id, layer.name);
  }, newMotionDoc(MotionFormat.Landscape));
}

const find = (layers: AnimatedLayer[], key: string) => layers.find((l) => l.key === key)!;

const source = frameOf([{ id: 'a1', name: 'Card', props: { shape: 'rect', x: 0.2, y: 0.3, width: 0.2, height: 0.2, rotation: 0, opacity: 1, fill: '#000000', roundness: 0 } }]);
const target = frameOf([{ id: 'b9', name: 'Card', props: { shape: 'rect', x: 0.8, y: 0.7, width: 0.4, height: 0.4, rotation: 90, opacity: 0.5, fill: '#ffffff', roundness: 0.4 } }]);

describe('smartAnimate', () => {
  it('layers with the same name across frames are matched', () => {
    const layers = smartAnimate(source, target, 0, Ease.Linear);

    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ role: LayerRole.Matched, key: 'Card' });
  });

  it('at 0 the layer is as in the source and at 1 as in the target', () => {
    expect(smartAnimate(source, target, 0, Ease.Linear)[0]).toMatchObject({ x: 0.2, y: 0.3, width: 0.2, rotation: 0, opacity: 1, fill: '#000000', radius: 0 });
    expect(smartAnimate(source, target, 1, Ease.Linear)[0]).toMatchObject({ x: 0.8, y: 0.7, width: 0.4, rotation: 90, opacity: 0.5, fill: '#ffffff', radius: 0.4 });
  });

  it('halfway with linear easing every property is the midpoint', () => {
    expect(smartAnimate(source, target, 0.5, Ease.Linear)[0]).toMatchObject({ x: 0.5, y: 0.5, width: 0.30000000000000004, rotation: 45, opacity: 0.75, fill: '#808080', radius: 0.2 });
  });

  it('the easing shapes the progress', () => {
    const linear = smartAnimate(source, target, 0.25, Ease.Linear)[0].x;
    const exit = smartAnimate(source, target, 0.25, Ease.Exit)[0].x;

    expect(exit).toBeLessThan(linear);
  });

  it('progress outside 0..1 is clamped', () => {
    expect(smartAnimate(source, target, 2, Ease.Linear)[0].x).toBe(0.8);
    expect(smartAnimate(source, target, -1, Ease.Linear)[0].x).toBe(0.2);
  });

  it('a layer only in the source fades out and one only in the target fades in', () => {
    const from = frameOf([{ id: 'a1', name: 'Old', props: { shape: 'rect', opacity: 0.8 } }]);
    const to = frameOf([{ id: 'b1', name: 'New', props: { shape: 'rect', opacity: 0.6 } }]);

    const mid = smartAnimate(from, to, 0.5, Ease.Linear);

    expect(find(mid, 'Old')).toMatchObject({ role: LayerRole.Leaving, opacity: 0.4 });
    expect(find(mid, 'New')).toMatchObject({ role: LayerRole.Entering, opacity: 0.3 });
    expect(find(smartAnimate(from, to, 1, Ease.Linear), 'Old').opacity).toBe(0);
    expect(find(smartAnimate(from, to, 0, Ease.Linear), 'New').opacity).toBe(0);
  });

  it('layers without a name match by id', () => {
    const from = frameOf([{ id: 'same', props: { shape: 'rect', x: 0.1 } }]);
    const to = frameOf([{ id: 'same', props: { shape: 'rect', x: 0.9 } }]);

    expect(smartAnimate(from, to, 0.5, Ease.Linear)[0]).toMatchObject({ role: LayerRole.Matched, x: 0.5 });
  });

  it('a name shared by two layers in one frame is not a match', () => {
    const from = frameOf([{ id: 'a1', name: 'Dot', props: { shape: 'rect' } }, { id: 'a2', name: 'Dot', props: { shape: 'rect' } }]);
    const to = frameOf([{ id: 'b1', name: 'Dot', props: { shape: 'rect' } }]);

    expect(smartAnimate(from, to, 0.5, Ease.Linear).every((l) => l.role !== LayerRole.Matched)).toBe(true);
  });

  it('layers of different kinds with the same name are not matched', () => {
    const from = frameOf([{ id: 'a1', name: 'Hero', props: { shape: 'rect' } }]);
    const to = newMotionDoc(MotionFormat.Landscape);
    const added = addClip(to, { component: 'Title', props: { text: 'Hero' }, from: 0, durationInFrames: 30 }, 'b1');
    const title = named(added.ok ? added.doc : to, 'b1', 'Hero');

    expect(smartAnimate(from, title, 0.5, Ease.Linear).map((l) => l.role).sort()).toEqual([LayerRole.Entering, LayerRole.Leaving]);
  });

  it('colours that are not hex switch at the midpoint', () => {
    const from = frameOf([{ id: 'a1', name: 'C', props: { shape: 'rect', fill: 'brand.accent' } }]);
    const to = frameOf([{ id: 'b1', name: 'C', props: { shape: 'rect', fill: '#ff0000' } }]);

    expect(smartAnimate(from, to, 0.4, Ease.Linear)[0].fill).toBe('brand.accent');
    expect(smartAnimate(from, to, 0.6, Ease.Linear)[0].fill).toBe('#ff0000');
  });

  it('an ellipse is fully rounded, so it morphs into a rectangle', () => {
    const from = frameOf([{ id: 'a1', name: 'Dot', props: { shape: 'ellipse', roundness: 0 } }]);
    const to = frameOf([{ id: 'b1', name: 'Dot', props: { shape: 'rect', roundness: 0 } }]);

    expect(smartAnimate(from, to, 0, Ease.Linear)[0].radius).toBe(0.5);
    expect(smartAnimate(from, to, 0.5, Ease.Linear)[0].radius).toBe(0.25);
    expect(smartAnimate(from, to, 1, Ease.Linear)[0].radius).toBe(0);
  });
});
