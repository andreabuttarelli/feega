import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from './compose';
import { EffectKind } from '../effects/registry';
import { addEffect } from '../effects/ops';
import { effectKey } from '../effects/model';
import { GRAIN_TILE, grainTile } from './three-grain';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = (component: 'Shape3D' | 'Shape') => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component, from: 0, durationInFrames: 60 }, 'rock'));
const grained = (component: 'Shape3D' | 'Shape') => ok(addEffect(shape(component), 'rock', EffectKind.Noise, 'g', { amount: 0.3, size: 2, evolve: 0 }));
const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('grain on a 3D clip', () => {
  it('is painted by the 3D renderer, not by an SVG filter around its canvas, which Safari drops on Retina and which repaints the whole frame every frame', () => {
    const html = compose(grained('Shape3D'));

    expect(html).not.toContain('<feTurbulence');
    expect(html).toContain('"grains":[{"amount":0.3,"size":2,"evolve":0}]');
  });

  it('paints stacked grains together, so a second grain does not bring the SVG filter back', () => {
    const html = compose(ok(addEffect(grained('Shape3D'), 'rock', EffectKind.Noise, 'h', { amount: 0.5, size: 4, evolve: 0 })));

    expect(html).not.toContain('<feTurbulence');
    expect(html).toContain('"grains":[{"amount":0.3,"size":2,"evolve":0},{"amount":0.5,"size":4,"evolve":0}]');
  });

  it('leaves a grain that follows another effect to the SVG filter, since effects apply in order', () => {
    const blurred = ok(addEffect(shape('Shape3D'), 'rock', EffectKind.GaussianBlur, 'b'));
    const html = compose(ok(addEffect(blurred, 'rock', EffectKind.Noise, 'g', { amount: 0.3, size: 2, evolve: 0 })));

    expect(html).toContain('<feTurbulence');
    expect(html).toContain('"grains":[]');
  });

  it('keeps the SVG filter when its grain is keyframed, since the renderer paints a fixed grain', () => {
    const doc = ok(setKeyframes(grained('Shape3D'), 'rock', effectKey('g', 'amount'), [{ frame: 0, value: 0.1, ease: Ease.Linear }, { frame: 30, value: 0.5, ease: Ease.Linear }]));
    const html = compose(doc);

    expect(html).toContain('<feTurbulence');
    expect(html).toContain('"grains":[]');
  });

  it('leaves grain on a 2D clip to the SVG filter', () => {
    expect(compose(grained('Shape'))).toContain('<feTurbulence');
  });
});

describe('the grain tile the 3D renderer samples', () => {
  const mean = (tile: Uint8Array) => tile.reduce((sum, v) => sum + v, 0) / tile.length / 255;
  const roughness = (tile: Uint8Array) => tile.reduce((sum, v, i) => sum + Math.abs(v - tile[i - (i % GRAIN_TILE) + ((i + 1) % GRAIN_TILE)]), 0) / tile.length;

  it('is one byte per pixel of a tile the size the SVG grain tiles', () => {
    expect(grainTile(2, 0)).toHaveLength(GRAIN_TILE * GRAIN_TILE);
  });

  it('is the same for the same seed and changes with it, so evolving grain moves', () => {
    expect(grainTile(2, 3)).toEqual(grainTile(2, 3));
    expect(grainTile(2, 3)).not.toEqual(grainTile(2, 4));
  });

  it('wraps seamlessly, so tiling shows no seam', () => {
    const tile = grainTile(4, 0);
    const across = Array.from({ length: GRAIN_TILE }, (_, y) => Math.abs(tile[y * GRAIN_TILE] - tile[y * GRAIN_TILE + GRAIN_TILE - 1]));
    expect(Math.max(...across)).toBeLessThan(40);
  });

  it('darkens a little on average, like the SVG grain it replaces', () => {
    expect(mean(grainTile(2, 0))).toBeGreaterThan(0.38);
    expect(mean(grainTile(2, 0))).toBeLessThan(0.5);
  });

  it('is coarser for a bigger grain size', () => {
    expect(roughness(grainTile(5, 0))).toBeLessThan(roughness(grainTile(1, 0)));
  });
});
