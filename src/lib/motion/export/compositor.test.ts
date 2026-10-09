import { describe, expect, it } from 'vitest';
import { composite, type Device } from './compositor';
import { EffectKind, IDENTITY, PaintKind, node, type Effect, type LayerTree, type Paint } from '../hyperframes/layer-tree';

const clip: Paint = { kind: PaintKind.Fill, color: [1, 1, 1, 1], width: 5, height: 5, at: IDENTITY };
const sheet = (n: number): Paint => ({ kind: PaintKind.Sheet, sheet: n, width: 10, height: 10, at: IDENTITY });
const grain: Effect = { kind: EffectKind.Grain, grains: [{ baseFrequency: 1, seed: 0, amount: 0.5 }], area: { inverse: [...IDENTITY], width: 10, height: 10, margin: 0.25 } };

function recorder() {
  const log: string[] = [];
  let made = 0;
  let live = 0;
  const device: Device<string> = {
    surface: () => {
      live += 1;
      return `s${made++}`;
    },
    release: (s) => {
      live -= 1;
      log.push(`release ${s}`);
    },
    fill: (s, rgba) => log.push(`fill ${s} ${rgba.join(',')}`),
    paint: (s, p) => log.push(`paint ${s} ${p.kind === PaintKind.Sheet ? `sheet${p.sheet}` : 'fill'}`),
    effect: (s, e) => {
      log.push(`${e.kind} ${s}`);
      return s;
    },
    mask: (s, m) => {
      log.push(`mask ${s} by ${m}`);
      return s;
    },
    blend: (into, from, opacity, mode) => log.push(`blend ${from}->${into} ${opacity} ${mode}`),
    finish: (s) => {
      log.push(`finish ${s}`);
      return s;
    }
  };
  return { device, log, live: () => live };
}

const tree = (root: LayerTree['root'], backdrop: LayerTree['backdrop'] = [0, 0, 0, 1]): LayerTree => ({ width: 10, height: 10, backdrop, root });

describe('composite', () => {
  it('paints plain layers straight into the frame, bottom first, over the backdrop', () => {
    const { device, log } = recorder();
    composite(device, tree(node({ children: [node({ paints: [sheet(0)] }), node({ paints: [sheet(1)] })] })));

    expect(log).toEqual(['fill s0 0,0,0,1', 'paint s0 sheet0', 'paint s0 sheet1', 'finish s0']);
  });

  it('draws a layer with a blend or an opacity on its own surface, then blends it once', () => {
    const { device, log, live } = recorder();
    composite(device, tree(node({ children: [node({ paints: [sheet(0)] }), node({ paints: [sheet(1)], blend: 'screen', opacity: 0.5 })] }), null));

    expect(log).toEqual(['paint s0 sheet0', 'paint s1 sheet1', 'blend s1->s0 0.5 screen', 'release s1', 'finish s0']);
    expect(live()).toBe(1);
  });

  it('runs a filter on everything the element holds, not on what lies under it', () => {
    const { device, log } = recorder();
    composite(device, tree(node({ children: [node({ paints: [sheet(0)] }), node({ effects: [grain], children: [node({ paints: [sheet(1)] }), node({ paints: [sheet(2)] })] })] }), null));

    expect(log).toEqual(['paint s0 sheet0', 'paint s1 sheet1', 'paint s1 sheet2', 'grain s1', 'blend s1->s0 1 normal', 'release s1', 'finish s0']);
  });

  it('clips what an element holds to its box, but not its own background', () => {
    const { device, log, live } = recorder();
    composite(device, tree(node({ children: [node({ paints: [sheet(0)], clip, children: [node({ paints: [sheet(1)] })] })] }), null));

    expect(log).toEqual(['paint s0 sheet0', 'paint s1 sheet1', 'paint s2 fill', 'mask s1 by s2', 'release s2', 'blend s1->s0 1 normal', 'release s1', 'finish s0']);
    expect(live()).toBe(1);
  });
});
