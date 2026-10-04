import { ValueKind } from '../keyframes';

export enum EffectKind {
  BrightnessContrast = 'brightness-contrast',
  HueSaturation = 'hue-saturation',
  Tint = 'tint',
  Curves = 'curves',
  BlackWhite = 'black-white',
  GaussianBlur = 'gaussian-blur',
  DirectionalBlur = 'directional-blur',
  DropShadow = 'drop-shadow',
  Glow = 'glow',
  Stroke = 'stroke',
  Noise = 'noise',
  ChromaticAberration = 'chromatic-aberration',
  Vignette = 'vignette',
  Wave = 'wave'
}

export const EFFECT_KINDS = Object.values(EffectKind) as [EffectKind, ...EffectKind[]];

export type EffectParam = { key: string; label: string; kind: ValueKind; min: number; max: number; step: number; fallback: number | string };

export type Values = Record<string, number | string>;

export type SvgNode = { tag: string; attrs: Record<string, string | number>; children?: SvgNode[] };

export type EffectFrame = { width: number; height: number; frame: number; fps: number };

export type Rendered = { filter: string; nodes: SvgNode[] };

type Spec = { label: string; about: string; params: EffectParam[]; varies?: (v: Values) => boolean; render: (v: Values, frame: EffectFrame, filterId: string) => Rendered };

const num = (key: string, label: string, min: number, max: number, step: number, fallback: number): EffectParam => ({ key, label, kind: ValueKind.Number, min, max, step, fallback });
const colour = (key: string, label: string, fallback: string): EffectParam => ({ key, label, kind: ValueKind.Color, min: 0, max: 0, step: 0, fallback });

const n = (v: Values, key: string) => Number(v[key]);
const r = (x: number) => Math.round(x * 10000) / 10000;
const rad = (deg: number) => (deg * Math.PI) / 180;

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function rgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0, 0, 0];
}

function rgba(hex: string, alpha: number): string {
  const [red, green, blue] = rgb(hex).map((c) => Math.round(c * 255));
  return `rgba(${red},${green},${blue},${r(alpha)})`;
}

const css = (filter: string): Rendered => ({ filter, nodes: [] });

const svg = (filterId: string, children: SvgNode[]): Rendered => ({
  filter: `url(#${filterId})`,
  nodes: [{ tag: 'filter', attrs: { id: filterId, x: '-25%', y: '-25%', width: '150%', height: '150%', 'color-interpolation-filters': 'sRGB' }, children }]
});

const node = (tag: string, attrs: SvgNode['attrs'], children?: SvgNode[]): SvgNode => (children ? { tag, attrs, children } : { tag, attrs });

const LUMA = [0.2126, 0.7152, 0.0722];

function tintMatrix(black: string, white: string, amount: number): string {
  const lo = rgb(black);
  const hi = rgb(white);
  const rows = [0, 1, 2].map((c) => {
    const tinted = LUMA.map((w) => w * (hi[c] - lo[c]));
    const own = [0, 1, 2].map((i) => (i === c ? 1 : 0));
    const mixed = own.map((o, i) => (1 - amount) * o + amount * tinted[i]);
    return [...mixed, 0, amount * lo[c]];
  });
  return [...rows, [0, 0, 0, 1, 0]].flat().map(r).join(' ');
}

const DIRECTIONAL_TAPS = 9;

function directionalTaps(length: number, angle: number): SvgNode[] {
  const nodes: SvgNode[] = [];
  for (let i = 0; i < DIRECTIONAL_TAPS; i++) {
    const t = (i / (DIRECTIONAL_TAPS - 1) - 0.5) * length;
    nodes.push(node('feOffset', { in: 'SourceGraphic', dx: r(Math.cos(rad(angle)) * t), dy: r(Math.sin(rad(angle)) * t), result: `tap${i}` }));
    if (i > 0) {
      const keep = i / (i + 1);
      nodes.push(node('feComposite', { in: i === 1 ? 'tap0' : `avg${i - 1}`, in2: `tap${i}`, operator: 'arithmetic', k1: 0, k2: r(keep), k3: r(1 - keep), k4: 0, result: `avg${i}` }));
    }
  }
  return nodes;
}

const ALPHA_ROW = '0 0 0 1 0';

const channel = (keep: number) =>
  [0, 1, 2]
    .map((row) => [0, 1, 2, 3, 4].map((col) => (row === keep && col === keep ? 1 : 0)).join(' '))
    .concat(ALPHA_ROW)
    .join(' ');

export const EFFECTS: Record<EffectKind, Spec> = {
  [EffectKind.BrightnessContrast]: {
    label: 'Brightness & contrast',
    about: 'brightness and contrast multipliers (1 = unchanged)',
    params: [num('brightness', 'Brightness', 0, 3, 0.01, 1), num('contrast', 'Contrast', 0, 3, 0.01, 1)],
    render: (v) => css(`brightness(${r(n(v, 'brightness'))}) contrast(${r(n(v, 'contrast'))})`)
  },
  [EffectKind.HueSaturation]: {
    label: 'Hue & saturation',
    about: 'hue rotation in degrees and saturation multiplier',
    params: [num('hue', 'Hue', -180, 180, 1, 0), num('saturation', 'Saturation', 0, 4, 0.01, 1)],
    render: (v) => css(`hue-rotate(${r(n(v, 'hue'))}deg) saturate(${r(n(v, 'saturation'))})`)
  },
  [EffectKind.Tint]: {
    label: 'Tint',
    about: 'maps black and white to two colours (colorize), mixed by amount',
    params: [colour('black', 'Map black to', '#000000'), colour('white', 'Map white to', '#ffffff'), num('amount', 'Amount', 0, 1, 0.01, 1)],
    render: (v, _f, id) => svg(id, [node('feColorMatrix', { type: 'matrix', values: tintMatrix(String(v.black), String(v.white), n(v, 'amount')) })])
  },
  [EffectKind.Curves]: {
    label: 'Curves',
    about: 'three-point RGB curve: output at shadows (0), midtones (0.5) and highlights (1)',
    params: [num('shadows', 'Shadows', 0, 1, 0.01, 0), num('midtones', 'Midtones', 0, 1, 0.01, 0.5), num('highlights', 'Highlights', 0, 1, 0.01, 1)],
    render: (v, _f, id) => {
      const table = [n(v, 'shadows'), n(v, 'midtones'), n(v, 'highlights')].map(r).join(' ');
      return svg(id, [node('feComponentTransfer', {}, ['feFuncR', 'feFuncG', 'feFuncB'].map((tag) => node(tag, { type: 'table', tableValues: table })))]);
    }
  },
  [EffectKind.BlackWhite]: {
    label: 'Black & white',
    about: 'desaturates; amount 0..1',
    params: [num('amount', 'Amount', 0, 1, 0.01, 1)],
    render: (v) => css(`grayscale(${r(n(v, 'amount'))})`)
  },
  [EffectKind.GaussianBlur]: {
    label: 'Gaussian blur',
    about: 'blur radius in px',
    params: [num('radius', 'Radius', 0, 200, 0.5, 8)],
    render: (v) => css(`blur(${r(n(v, 'radius'))}px)`)
  },
  [EffectKind.DirectionalBlur]: {
    label: 'Directional blur',
    about: 'motion blur of length px along angle degrees',
    params: [num('length', 'Length', 0, 400, 1, 40), num('angle', 'Angle', -180, 180, 1, 0)],
    render: (v, _f, id) => svg(id, directionalTaps(n(v, 'length'), n(v, 'angle')))
  },
  [EffectKind.DropShadow]: {
    label: 'Drop shadow',
    about: 'shadow at distance px and angle degrees, blur px, colour and opacity',
    params: [num('distance', 'Distance', 0, 300, 1, 16), num('angle', 'Angle', -180, 180, 1, 135), num('blur', 'Softness', 0, 200, 0.5, 24), colour('color', 'Colour', '#000000'), num('opacity', 'Opacity', 0, 1, 0.01, 0.5)],
    render: (v) => {
      const d = n(v, 'distance');
      const a = rad(n(v, 'angle'));
      return css(`drop-shadow(${r(Math.cos(a) * d)}px ${r(Math.sin(a) * d)}px ${r(n(v, 'blur'))}px ${rgba(String(v.color), n(v, 'opacity'))})`);
    }
  },
  [EffectKind.Glow]: {
    label: 'Glow',
    about: 'soft light around the layer: radius px, colour, intensity 0..1',
    params: [num('radius', 'Radius', 0, 200, 0.5, 24), colour('color', 'Colour', '#ffffff'), num('intensity', 'Intensity', 0, 1, 0.01, 0.8)],
    render: (v) => {
      const c = rgba(String(v.color), n(v, 'intensity'));
      return css(`drop-shadow(0px 0px ${r(n(v, 'radius') / 3)}px ${c}) drop-shadow(0px 0px ${r(n(v, 'radius'))}px ${c})`);
    }
  },
  [EffectKind.Stroke]: {
    label: 'Stroke',
    about: 'outline around the layer alpha: width px and colour',
    params: [num('width', 'Width', 0, 60, 0.5, 4), colour('color', 'Colour', '#ffffff')],
    render: (v, _f, id) =>
      svg(id, [
        node('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: r(n(v, 'width')), result: 'grown' }),
        node('feFlood', { 'flood-color': String(v.color), result: 'ink' }),
        node('feComposite', { in: 'ink', in2: 'grown', operator: 'in', result: 'line' }),
        node('feMerge', {}, [node('feMergeNode', { in: 'line' }), node('feMergeNode', { in: 'SourceGraphic' })])
      ])
  },
  [EffectKind.Noise]: {
    label: 'Noise & grain',
    about: 'film grain: amount 0..1, grain size px, evolve 0 = still, 1 = new grain every frame',
    params: [num('amount', 'Amount', 0, 1, 0.01, 0.2), num('size', 'Size', 0.5, 8, 0.1, 1.5), num('evolve', 'Evolve', 0, 1, 0.01, 1)],
    varies: (v) => n(v, 'evolve') > 0,
    render: (v, f, id) => {
      const amount = n(v, 'amount');
      return svg(id, [
        node('feTurbulence', { type: 'fractalNoise', baseFrequency: r(1 / n(v, 'size')), numOctaves: 1, seed: Math.floor(f.frame * n(v, 'evolve')), result: 'grain' }),
        node('feColorMatrix', { in: 'grain', type: 'saturate', values: 0, result: 'gray' }),
        node('feComposite', { in: 'gray', in2: 'SourceGraphic', operator: 'arithmetic', k1: 0, k2: r(amount), k3: 1, k4: r(-amount / 2), result: 'mixed' }),
        node('feComposite', { in: 'mixed', in2: 'SourceAlpha', operator: 'in' })
      ]);
    }
  },
  [EffectKind.ChromaticAberration]: {
    label: 'Chromatic aberration',
    about: 'splits red and blue by offset px along angle degrees',
    params: [num('offset', 'Offset', 0, 60, 0.5, 6), num('angle', 'Angle', -180, 180, 1, 0)],
    render: (v, _f, id) => {
      const d = n(v, 'offset');
      const a = rad(n(v, 'angle'));
      const dx = r(Math.cos(a) * d);
      const dy = r(Math.sin(a) * d);
      return svg(id, [
        node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: channel(0), result: 'red' }),
        node('feOffset', { in: 'red', dx, dy, result: 'redShift' }),
        node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: channel(1), result: 'green' }),
        node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: channel(2), result: 'blue' }),
        node('feOffset', { in: 'blue', dx: -dx, dy: -dy, result: 'blueShift' }),
        node('feBlend', { in: 'redShift', in2: 'green', mode: 'screen', result: 'rg' }),
        node('feBlend', { in: 'rg', in2: 'blueShift', mode: 'screen' })
      ]);
    }
  },
  [EffectKind.Vignette]: {
    label: 'Vignette',
    about: 'darkens toward the frame edges; amount 0..1',
    params: [num('amount', 'Amount', 0, 1, 0.01, 0.5)],
    render: (v, f, id) => {
      const diagonal = Math.hypot(f.width, f.height);
      const height = diagonal * (2.5 * (1 - n(v, 'amount')) + 0.25);
      return svg(id, [
        node('feDiffuseLighting', { in: 'SourceAlpha', surfaceScale: 0, diffuseConstant: 1, 'lighting-color': '#ffffff', result: 'light' }, [node('fePointLight', { x: r(f.width / 2), y: r(f.height / 2), z: r(height) })]),
        node('feComposite', { in: 'SourceGraphic', in2: 'light', operator: 'arithmetic', k1: 1, k2: 0, k3: 0, k4: 0 })
      ]);
    }
  },
  [EffectKind.Wave]: {
    label: 'Wave distort',
    about: 'displaces the layer with a flowing noise: amount px, scale px, speed px/s',
    params: [num('amount', 'Amount', 0, 200, 1, 24), num('scale', 'Scale', 10, 1000, 1, 160), num('speed', 'Speed', 0, 1000, 1, 120)],
    varies: (v) => n(v, 'speed') > 0,
    render: (v, f, id) => {
      const shift = r((n(v, 'speed') * f.frame) / f.fps);
      return svg(id, [
        node('feTurbulence', { type: 'fractalNoise', baseFrequency: r(1 / n(v, 'scale')), numOctaves: 2, seed: 3, x: -shift, y: 0, width: r(f.width + shift), height: f.height, result: 'field' }),
        node('feOffset', { in: 'field', dx: shift, dy: 0, result: 'moved' }),
        node('feDisplacementMap', { in: 'SourceGraphic', in2: 'moved', scale: r(n(v, 'amount')), xChannelSelector: 'R', yChannelSelector: 'G' })
      ]);
    }
  }
};

export function defaultValues(kind: EffectKind): Values {
  return Object.fromEntries(EFFECTS[kind].params.map((p) => [p.key, p.fallback]));
}
