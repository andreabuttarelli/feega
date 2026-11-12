import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'ink-spread-transition',
  title: 'Ink spread transition',
  about: 'Ink droplets spread across the first page, merge through a gooey ragged edge and cover it, then the second scene lands.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#1a1a1a',
  fonts: [],
  props: {
    labelBefore: { type: 'string', title: 'Before label', default: 'Before', group: 'Content', maxLength: 30 },
    labelAfter: { type: 'string', title: 'After label', default: 'After', group: 'Content', maxLength: 30 },
    colorBefore: { type: 'string', title: 'Before colour', format: PropFormat.Color, default: '#f5f1e8', group: 'Style' },
    colorAfter: { type: 'string', title: 'Ink colour', format: PropFormat.Color, default: '#1a1a1a', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#1a1a1a', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, frames } = view;
    const colorBefore = String(p.colorBefore);
    const colorAfter = String(p.colorAfter);
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const INK_START = 14;
    const INK_END = 60;
    const LABEL_IN = 36;
    const LABEL_FULL = 58;
    const DROP_COUNT = 7;
    const SPECK_COUNT = 10;
    const diag = Math.sqrt(width * width + height * height);
    const easeInOut = S.Easing.inOut(S.Easing.ease);

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };

    const circle = (fillColor: string) => S.h('circle', { cx: 0, cy: 0, r: 0, fill: fillColor });
    const group = (attrs: Record<string, string | number>, circles: Element[]) => S.h('g', attrs, circles) as SVGElement;
    const haloDrops = Array.from({ length: DROP_COUNT }, () => circle(colorAfter));
    const haloSpecks = Array.from({ length: SPECK_COUNT }, () => circle(colorAfter));
    const coreDrops = Array.from({ length: DROP_COUNT }, () => circle(colorAfter));
    const coreSpecks = Array.from({ length: SPECK_COUNT }, () => circle(colorAfter));

    const filter = (id: string, blur: number, matrixAlpha: string, freq: string, octaves: number, seed: number, displace: number, finalBlur: number) =>
      S.h('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%', colorInterpolationFilters: 'sRGB' },
        S.h('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blur, result: 'b' }),
        S.h('feColorMatrix', { in: 'b', type: 'matrix', values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${matrixAlpha}`, result: 't' }),
        S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: octaves, seed, result: 'n' }),
        S.h('feDisplacementMap', { in: 't', in2: 'n', scale: displace, xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
        S.h('feGaussianBlur', { in: 'd', stdDeviation: finalBlur })
      );

    const ink = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } },
      S.h('defs', null, filter('ink-bleed', 26, '9 -3.2', '0.009 0.013', 3, 17, 46, 7), filter('ink-core', 17, '24 -9.5', '0.013 0.017', 4, 41, 24, 2.2)),
      group({ filter: 'url(#ink-bleed)', opacity: 0.55 }, [...haloDrops, ...haloSpecks]),
      group({ filter: 'url(#ink-core)' }, [...coreDrops, ...coreSpecks])
    ) as SVGElement;

    const afterLabel = S.h('div', { style: { fontFamily: face, fontSize: 220, fontWeight: 800, letterSpacing: 34, color: colorBefore, textShadow: '0 4px 24px rgba(0,0,0,0.45)' } }, String(p.labelAfter)) as HTMLElement;
    const afterLayer = S.fill({ alignItems: 'center', justifyContent: 'center', opacity: 0, pointerEvents: 'none' }, afterLabel) as HTMLElement;
    const beforeLayer = S.fill({ backgroundColor: colorBefore, alignItems: 'center', justifyContent: 'center' },
      S.h('div', { style: { fontFamily: face, fontSize: 220, fontWeight: 800, letterSpacing: 16, color: String(p.textColor), textShadow: '0 4px 24px rgba(0,0,0,0.12)' } }, String(p.labelBefore)));
    view.root.replaceChildren(S.fill({ backgroundColor: colorAfter }, beforeLayer, ink, afterLayer));

    const place = (el: Element, cx: number, cy: number, r: number) => {
      el.setAttribute('cx', String(cx));
      el.setAttribute('cy', String(cy));
      el.setAttribute('r', String(Math.max(0, r)));
    };

    return (frame) => {
      const progress = S.interpolate(frame, [INK_START, INK_END], [0, 1], { ...clamped, easing: easeInOut });
      ink.style.display = progress > 0.001 ? 'block' : 'none';

      for (let i = 0; i < DROP_COUNT; i++) {
        const anchored = i === 0;
        const cx = anchored ? width / 2 : width * (0.5 + (seededRandom(i * 67 + 11) - 0.5) * 0.46);
        const cy = anchored ? height / 2 : height * (0.5 + (seededRandom(i * 89 + 23) - 0.5) * 0.5);
        const dropDelay = anchored ? 0 : seededRandom(i * 43 + 7) * 0.36;
        const local = S.interpolate(progress, [dropDelay, 1], [0, 1], clamped);
        const spread = 1 - Math.pow(1 - local, 2.2);
        const size = anchored ? 0.95 : 0.5 + seededRandom(i * 29 + 5) * 0.55;
        const r = spread * diag * 0.62 * size;
        place(haloDrops[i], cx, cy, r * 1.06);
        place(coreDrops[i], cx, cy, r);
      }

      for (let i = 0; i < SPECK_COUNT; i++) {
        const angle = seededRandom(i * 17 + 3) * Math.PI * 2;
        const dist = (0.2 + seededRandom(i * 53 + 9) * 0.42) * diag * 0.5;
        const appear = 0.12 + seededRandom(i * 71 + 13) * 0.5;
        const local = S.interpolate(progress, [appear, Math.min(1, appear + 0.3)], [0, 1], clamped);
        const cx = width / 2 + Math.cos(angle) * dist;
        const cy = height / 2 + Math.sin(angle) * dist * 0.78;
        const r = local * diag * (0.012 + seededRandom(i * 37 + 2) * 0.03);
        place(haloSpecks[i], cx, cy, r);
        place(coreSpecks[i], cx, cy, r * 0.82);
      }

      afterLayer.style.opacity = String(S.interpolate(frame, [LABEL_IN, LABEL_FULL], [0, 1], clamped));
      afterLabel.style.letterSpacing = `${S.interpolate(frame, [LABEL_IN, frames - 14], [34, 16], { ...clamped, easing: S.Easing.out(S.Easing.cubic) })}px`;
    };
  }
};
