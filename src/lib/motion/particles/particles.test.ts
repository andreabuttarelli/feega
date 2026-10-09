import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { COMPONENTS } from '../components';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { keyframesProblem } from '../keyframes';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { PARTICLE_STATE, particleBake } from '../hyperframes/particles';
import { MAX_GLOW_PX, MIN_GLOW_PX, PARTICLE_STRIDE, drawParticles, glowTiles, particleQuads, particlesAt, type Particle, type ParticleBake } from './simulate';
import { PARTICLE_PRESETS, ParticlePreset, applyParticlePreset, PRESET_PROPS } from './presets';
import { Emitter } from './model';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const env = { width: 1000, height: 1000, unit: 1000, fps: 30, color: (v: string) => v };

const clipOf = (props: Record<string, unknown> = {}, keyframes: MotionClip['keyframes'] = {}, durationInFrames = 120): MotionClip =>
  ({ id: 'p1', component: 'Particles', from: 0, durationInFrames, props: COMPONENTS.Particles.schema.parse(props), keyframes, transform: {} }) as unknown as MotionClip;

const bakeOf = (props: Record<string, unknown> = {}, keyframes: MotionClip['keyframes'] = {}): ParticleBake => particleBake(clipOf(props, keyframes), env);

describe('particles are a pure function of time', () => {
  it('a frame reached by seeking straight to it equals the same frame reached after playing up to it', () => {
    const bake = bakeOf({ rate: 90, gravity: 1, drag: 0.5, wobble: 0.02 });
    const direct = particlesAt(bake, 47);
    for (let f = 0; f < 47; f++) {
      particlesAt(bake, f);
    }
    expect(particlesAt(bake, 47)).toEqual(direct);
    expect(direct.length).toBeGreaterThan(10);
  });

  it('the same seed draws the same particles, another seed draws others', () => {
    const one = particlesAt(bakeOf({ seed: 7 }), 30);
    expect(particlesAt(bakeOf({ seed: 7 }), 30)).toEqual(one);
    expect(particlesAt(bakeOf({ seed: 8 }), 30)).not.toEqual(one);
  });

  it('remembering each particle across frames gives the same frames, and remembers each particle once', () => {
    const bake = bakeOf({ emitter: Emitter.Box, rate: 120, gravity: 1, drag: 0.5, wobble: 0.02, prewarm: true });
    const memo = new Map();
    for (const f of [0, 1, 2, 30, 31, 90, 12]) {
      expect(particlesAt(bake, f + 0.5, memo)).toEqual(particlesAt(bake, f + 0.5));
    }
    const remembered = memo.size;
    particlesAt(bake, 30.5, memo);
    expect(memo.size).toBe(remembered);
    expect(remembered).toBeGreaterThan(100);
  });

  it('the runtime copy of the simulation is self-contained and gives the same answer', () => {
    const bake = bakeOf({ emitter: Emitter.Ring, rate: 120 });
    const copy = new Function(`return (${particlesAt.toString()})`)() as typeof particlesAt;
    expect(copy(bake, 33.5)).toEqual(particlesAt(bake, 33.5));
  });

  it('emits rate particles per second and none before the clip starts', () => {
    const bake = bakeOf({ rate: 60, life: 10, lifeVariance: 0 });
    expect(particlesAt(bake, -1)).toHaveLength(0);
    expect(particlesAt(bake, 30)).toHaveLength(61);
  });

  it('a particle is gone once its life is over', () => {
    const bake = bakeOf({ rate: 30, life: 0.5, lifeVariance: 0 }, { rate: [{ frame: 0, value: 30, ease: Ease.Linear, out: 'hold' as never }, { frame: 10, value: 0, ease: Ease.Linear }] });
    expect(particlesAt(bake, 12).length).toBeGreaterThan(0);
    expect(particlesAt(bake, 40)).toHaveLength(0);
  });

  it('gravity pulls particles down the frame', () => {
    const still = { rate: 10, speed: 0, speedVariance: 0, life: 10, emitter: Emitter.Point };
    const floating = particlesAt(bakeOf({ ...still, gravity: 0 }), 30)[0];
    const falling = particlesAt(bakeOf({ ...still, gravity: 1 }), 30)[0];
    expect(falling.x).toBeCloseTo(floating.x);
    expect(falling.y).toBeGreaterThan(floating.y + 100);
  });

  it('colour and size move from start to end over a particle life', () => {
    const bake = bakeOf({ rate: 30, life: 1, lifeVariance: 0, sizeVariance: 0, sizeStart: 0.1, sizeEnd: 0, colorStart: '#ff0000', colorEnd: '#0000ff' });
    const [oldest] = particlesAt(bake, 15);
    expect(oldest.size).toBeCloseTo(50, 0);
    expect(oldest.r).toBeCloseTo(127.5, 0);
    expect(oldest.b).toBeCloseTo(127.5, 0);
  });

  it('prewarm fills the frame at the first frame, as if it had been running', () => {
    expect(particlesAt(bakeOf({ prewarm: false }), 0).length).toBeLessThanOrEqual(1);
    expect(particlesAt(bakeOf({ prewarm: true }), 0).length).toBeGreaterThan(20);
  });

  it('a still emitter bakes one row, a keyed one bakes a row per frame', () => {
    expect(bakeOf().rows).toHaveLength(1);
    const keyed = bakeOf({}, { speed: [{ frame: 0, value: 0.1, ease: Ease.Linear }, { frame: 60, value: 1, ease: Ease.Linear }] });
    expect(keyed.rows).toHaveLength(120);
    expect(keyed.rows[60].speed).toBeCloseTo(1);
  });
});

describe('every particle parameter is keyframable', () => {
  it.each(['rate', 'life', 'speed', 'direction', 'spread', 'gravity', 'sizeStart', 'sizeEnd', 'opacityEnd', 'colorStart', 'colorEnd', 'emitterX', 'emitterY', 'emitterWidth'])('%s takes keyframes', (key) => {
    const value = key.startsWith('color') ? '#ff8800' : 0.1;
    expect(keyframesProblem({ component: 'Particles', mask: null, keyframes: { [key]: [{ frame: 0, value, ease: Ease.Linear }] } })).toBeNull();
  });
});

describe('particle presets', () => {
  it.each(PARTICLE_PRESETS)('%s is a valid set of particle props', (preset) => {
    expect(COMPONENTS.Particles.schema.safeParse(PRESET_PROPS[preset].props).success).toBe(true);
  });

  it('a preset replaces the look and keeps the seed', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 0, durationInFrames: 60, props: { seed: 42 } }, 'p'));
    const snowy = must(applyParticlePreset(doc, 'p', ParticlePreset.Snow));
    const props = findClip(snowy, 'p')!.clip.props;
    expect(props.seed).toBe(42);
    expect(props.gravity).toBe(PRESET_PROPS[ParticlePreset.Snow].props.gravity);
  });

  it('a preset on a clip that is not particles is refused', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 't'));
    expect(applyParticlePreset(doc, 't', ParticlePreset.Snow).ok).toBe(false);
  });
});

describe('particles in the composition', () => {
  it('draws on a canvas the size of the frame, driven by the timeline', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 15, durationInFrames: 60 }, 'p'));
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });
    expect(html).toContain('<canvas id="pt-p" width="1920" height="1080"');
    expect(html).toContain('const PT_AT=(');
    expect(html).toContain('"id":"p","from":15');
  });

  it('a keyed rate reaches the runtime as one row per frame', () => {
    const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 0, durationInFrames: 30 }, 'p'));
    const doc = must(setKeyframes(base, 'p', 'rate', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 29, value: 200, ease: Ease.Linear }]));
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });
    expect(html.match(/"rate":/g)?.length).toBe(30);
  });

  it('each frame leaves its particles on the canvas for the export to draw, not just their pixels', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 0, durationInFrames: 30 }, 'p'));
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });
    expect(html).toContain('const PT_QUADS=(');
    expect(html).toContain(`[${JSON.stringify(PARTICLE_STATE)}]=`);
  });
});

describe('particles as GPU quads', () => {
  it('packs every particle as one row: place, size, turn, rounded colour, opacity, softness', () => {
    const quads = particleQuads([{ x: 1, y: 2, size: 3, angle: 0.5, r: 10.4, g: 20.6, b: 254.5, alpha: 0.25, softness: 0.75 }]);
    expect([...quads]).toEqual([1, 2, 3, 0.5, 10, 21, 255, 0.25, 0.75]);
    expect(quads.length).toBe(PARTICLE_STRIDE);
  });

  it('the GPU glow takes its tile size from the same bounds as the 2D glow sheet', () => {
    const { paint, images } = countingPaint();
    const tiles = glowTiles(() => ({ width: 0, height: 0, getContext: () => countingPaint().paint }) as unknown as HTMLCanvasElement);
    drawParticles(paint, [{ ...softDot(10), size: 1 }, { ...softDot(20), size: 5000, r: 1 }], 'circle', null, tiles);
    expect(images.map((args) => args[2])).toEqual([MIN_GLOW_PX, MAX_GLOW_PX]);
  });

  it('the runtime copy of the packing is self-contained', () => {
    const copy = new Function(`return (${particleQuads.toString()})`)() as typeof particleQuads;
    expect(copy([softDot(1), softDot(2)]).length).toBe(2 * PARTICLE_STRIDE);
  });
});

function countingPaint(): { paint: CanvasRenderingContext2D; calls: Record<string, number>; images: number[][] } {
  const calls: Record<string, number> = {};
  const images: number[][] = [];
  const count = (name: string) => (...args: unknown[]) => {
    calls[name] = (calls[name] ?? 0) + 1;
    if (name === 'drawImage') {
      images.push(args.slice(1) as number[]);
    }
    return name === 'createRadialGradient' ? { addColorStop: count('addColorStop') } : undefined;
  };
  const paint = new Proxy({ canvas: { width: 100, height: 100 } } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : count(key)),
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    }
  });
  return { paint: paint as unknown as CanvasRenderingContext2D, calls, images };
}

const softDot = (x: number): Particle => ({ x, y: 10, size: 4, angle: x, r: 255, g: 255, b: 255, alpha: 0.9, softness: 0.3 });

describe('drawing particles stays cheap per frame', () => {
  it('soft particles share one glow sheet, painted once and kept from frame to frame', () => {
    const { paint, calls } = countingPaint();
    const made: Record<string, number>[] = [];
    const counted = glowTiles(() => {
      const fresh = countingPaint();
      made.push(fresh.calls);
      return { width: 0, height: 0, getContext: () => fresh.paint } as unknown as HTMLCanvasElement;
    });
    const dots = Array.from({ length: 500 }, (_, i) => softDot(i % 100));
    drawParticles(paint, dots, 'circle', null, counted);
    drawParticles(paint, dots, 'circle', null, counted);
    expect(made).toHaveLength(1);
    expect(made[0].createRadialGradient).toBe(1);
    expect(calls.drawImage).toBe(1000);
  });

  it('a glow that no longer fits the sheet starts a fresh one', () => {
    const { paint } = countingPaint();
    const made: Record<string, number>[] = [];
    const counted = glowTiles(() => {
      const fresh = countingPaint();
      made.push(fresh.calls);
      return { width: 0, height: 0, getContext: () => fresh.paint } as unknown as HTMLCanvasElement;
    });
    const big = (r: number): Particle => ({ ...softDot(0), size: 1000, r });
    drawParticles(paint, [big(10), big(20), big(10)], 'circle', null, counted);
    expect(made).toHaveLength(2);
  });

  it('glows on the sheet keep a gap as wide as themselves, so shrinking one never samples its neighbour', () => {
    const { paint, images } = countingPaint();
    const tiles = glowTiles(() => ({ width: 0, height: 0, getContext: () => countingPaint().paint }) as unknown as HTMLCanvasElement);
    drawParticles(paint, [softDot(10), { ...softDot(20), r: 10 }], 'circle', null, tiles);
    const [first, second] = images;
    expect(second[0] - (first[0] + first[2])).toBeGreaterThanOrEqual(first[2]);
  });

  it('a particle wholly outside the canvas is not drawn', () => {
    const { paint, calls } = countingPaint();
    const at = (x: number, y: number): Particle => ({ ...softDot(x), y });
    const outside = [at(-50, 10), at(150, 10), at(50, -30), at(50, 130)];
    drawParticles(paint, [...outside, at(50, 10), at(-1, 50)], 'square', null, glowTiles(() => document.createElement('canvas')));
    expect(calls.fillRect).toBe(2);
  });

  it('no particle saves and restores the whole canvas state', () => {
    const { paint, calls } = countingPaint();
    drawParticles(
      paint,
      Array.from({ length: 500 }, (_, i) => softDot(i % 100)),
      'square',
      null,
      glowTiles(() => {
        throw new Error('a square needs no glow');
      })
    );
    expect(calls.save ?? 0).toBe(0);
    expect(calls.fillRect).toBe(500);
  });

  it('the runtime copy of the drawing is self-contained', () => {
    const copy = new Function(`return (${drawParticles.toString()})`)() as typeof drawParticles;
    const tiles = new Function(`return (${glowTiles.toString()})`)() as typeof glowTiles;
    const { paint, calls } = countingPaint();
    copy(
      paint,
      [softDot(1), softDot(2)],
      'circle',
      null,
      tiles(() => ({ width: 0, height: 0, getContext: () => countingPaint().paint }) as unknown as HTMLCanvasElement)
    );
    expect(calls.drawImage).toBe(2);
  });
});
