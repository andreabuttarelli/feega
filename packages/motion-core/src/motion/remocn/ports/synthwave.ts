import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'synthwave',
  title: 'Synthwave',
  about: 'Retro outrun landscape: a striped sun rising over mountains above an endlessly scrolling neon grid.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#08080B',
  fonts: [],
  props: {
    gridSpeed: { type: 'number', title: 'Grid speed', default: 2, minimum: 0, maximum: 6, step: 0.25, group: 'Motion' },
    horizon: { type: 'number', title: 'Horizon', default: 0.6, minimum: 0.4, maximum: 0.8, step: 0.01, group: 'Style' },
    sunStripes: { type: 'boolean', title: 'Scrolling sun stripes', default: true, group: 'Motion' },
    grid: { type: 'string', title: 'Grid', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    sunTop: { type: 'string', title: 'Sun top', format: PropFormat.Color, default: '#FFC46B', group: 'Style' },
    sunBottom: { type: 'string', title: 'Sun bottom', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    skyHorizon: { type: 'string', title: 'Horizon glow', format: PropFormat.Color, default: '#3B0C10', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const SKY_TOP = '#08080B';
    const FLOOR = '#0A0A0C';
    const MOUNTAINS_BACK = '#2A0A0E';
    const MOUNTAINS_FRONT = '#111111';
    const ROWS = 70;
    const ROW_GAP = 0.5;
    const COLUMN_RANGE = 11;
    const NEAR_Z = 0.35;
    const STRIPES = 7;
    const STARS = 70;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = S.Easing.out(S.Easing.cubic);
    const gridColor = String(p.grid);
    const skyHorizon = String(p.skyHorizon);
    const gridSpeed = Number(p.gridSpeed);
    const stripesOn = Boolean(p.sunStripes);
    const u = Math.min(W, H) / 720;
    const cx = W / 2;
    const yh = Number(p.horizon) * H;
    const floorDepth = H - yh;
    const colSpread = W * 0.16;
    const R = 0.27 * H;

    const ridge = (seed: string, base: number, peak: number, count: number) => {
      const points: string[] = [`${-0.4 * W},${base}`];
      for (let i = 0; i <= count; i++) {
        const x = -0.4 * W + (i / count) * 1.8 * W;
        const center = Math.min(1, Math.abs(x - W / 2) / (0.45 * W));
        const valley = 0.18 + 0.82 * center * center;
        const jag = 0.45 + 0.55 * S.random(`${seed}-${i}`);
        points.push(`${x},${base - peak * valley * (i % 2 === 0 ? jag : jag * 0.45)}`);
      }
      points.push(`${1.4 * W},${base}`);
      return points.join(' ');
    };
    const back = ridge('synthwave-back', yh, 0.26 * H, 27);
    const front = ridge('synthwave-front', yh, 0.15 * H, 39);

    const gradient = (id: string, stops: [number, string][]) =>
      S.h('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, stops.map(([offset, color]) => S.h('stop', { offset, stopColor: color })));
    const stripeRects = Array.from({ length: STRIPES }, () => S.h('rect', { x: 0, width: W, fill: '#000' }));
    const stars = Array.from({ length: STARS }, (_, i) => {
      const phase = S.random(`synthwave-sp-${i}`) * 9;
      const el = S.h('circle', {
        cx: S.random(`synthwave-sx-${i}`) * W,
        cy: S.random(`synthwave-sy-${i}`) * yh * 0.8,
        r: (0.6 + S.random(`synthwave-sr-${i}`) * 1.4) * u
      });
      return { el, phase };
    });
    const columns = Array.from({ length: COLUMN_RANGE * 2 + 1 }, (_, i) => {
      const j = i - COLUMN_RANGE;
      return S.h('line', { x1: cx, y1: yh, x2: cx + (j * colSpread) / NEAR_Z, y2: yh + floorDepth / NEAR_Z });
    });
    const rows = Array.from({ length: ROWS }, () => S.h('line', { x1: 0, x2: W }));

    const haze = S.h('circle', { cx, r: R * 1.15, fill: String(p.sunBottom), opacity: 0.45, filter: 'url(#sw-haze)' });
    const sun = S.h('circle', { cx, r: R, fill: 'url(#sw-sun)', mask: 'url(#sw-stripes)' });
    const backPoly = S.h('polygon', { points: back, fill: MOUNTAINS_BACK });
    const frontGroup = S.h(
      'g',
      null,
      S.h('polygon', { points: front, fill: MOUNTAINS_FRONT }),
      S.h('polyline', { points: front, fill: 'none', stroke: gridColor, strokeWidth: 1.5 * u, strokeOpacity: 0.55, strokeLinejoin: 'round' })
    );

    const svg = S.h(
      'svg',
      { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      S.h(
        'defs',
        null,
        gradient('sw-sky', [[0, SKY_TOP], [0.55, SKY_TOP], [1, skyHorizon]]),
        gradient('sw-sun', [[0.1, String(p.sunTop)], [0.85, String(p.sunBottom)]]),
        gradient('sw-floor', [[0, skyHorizon], [0.25, FLOOR]]),
        S.h('mask', { id: 'sw-stripes' }, S.h('rect', { width: W, height: H, fill: '#fff' }), stripeRects),
        S.h('clipPath', { id: 'sw-above' }, S.h('rect', { width: W, height: yh })),
        S.h(
          'filter',
          { id: 'sw-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' },
          S.h('feGaussianBlur', { stdDeviation: 4 * u, result: 'blur' }),
          S.h('feMerge', null, S.h('feMergeNode', { in: 'blur' }), S.h('feMergeNode', { in: 'blur' }), S.h('feMergeNode', { in: 'SourceGraphic' }))
        ),
        S.h('filter', { id: 'sw-haze', x: '-50%', y: '-50%', width: '200%', height: '200%' }, S.h('feGaussianBlur', { stdDeviation: 30 * u }))
      ),
      S.h('rect', { width: W, height: yh, fill: 'url(#sw-sky)' }),
      S.h('g', { fill: '#FFFFFF' }, stars.map((s) => s.el)),
      S.h('g', { clipPath: 'url(#sw-above)' }, haze, sun, backPoly, frontGroup),
      S.h('rect', { y: yh, width: W, height: H - yh, fill: 'url(#sw-floor)' }),
      S.h(
        'g',
        { stroke: gridColor, strokeWidth: 2.2 * u, filter: 'url(#sw-glow)', fill: 'none' },
        columns,
        rows,
        S.h('line', { x1: 0, y1: yh, x2: W, y2: yh, strokeWidth: 3 * u })
      ),
      S.h('rect', { y: yh - 6 * u, width: W, height: 0.12 * H, fill: skyHorizon, opacity: 0.5, filter: 'url(#sw-haze)' })
    );
    view.root.replaceChildren(S.fill({}, svg));

    return (t) => {
      const phase = ((((t / 30) * gridSpeed) % 1) + 1) % 1;
      rows.forEach((row, k) => {
        const z = 0.7 + (k + 1 - phase) * ROW_GAP;
        const y = yh + floorDepth / z;
        if (y > H + 4 * u) {
          row.setAttribute('display', 'none');
          return;
        }
        row.removeAttribute('display');
        row.setAttribute('y1', String(y));
        row.setAttribute('y2', String(y));
        row.setAttribute('stroke-opacity', String(S.interpolate(z, [1, 14, 30], [1, 0.35, 0], clamp)));
      });

      const rise = S.interpolate(t, [0, 40], [0, 1], { ...clamp, easing: outCubic });
      const sunY = S.interpolate(rise, [0, 1], [yh + R * 1.05, yh - R * 0.42]);
      const stripePhase = stripesOn ? (((t / 36) % 1) + 1) % 1 : 0;
      stripeRects.forEach((rect, i) => {
        const q = (i + stripePhase) / STRIPES;
        const h = R * (0.012 + 0.09 * q);
        rect.setAttribute('y', String(sunY + R * (-0.05 + q * 1.05) - h / 2));
        rect.setAttribute('height', String(h));
      });
      haze.setAttribute('cy', String(sunY));
      sun.setAttribute('cy', String(sunY));

      const slideBack = S.interpolate(t, [4, 34], [1, 0], { ...clamp, easing: outCubic });
      const slideFront = S.interpolate(t, [8, 38], [1, 0], { ...clamp, easing: outCubic });
      backPoly.setAttribute('transform', `translate(${-0.25 * W * slideBack} ${0.3 * H * slideBack})`);
      frontGroup.setAttribute('transform', `translate(${0.25 * W * slideFront} ${0.2 * H * slideFront})`);

      stars.forEach((s) => s.el.setAttribute('opacity', String(0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.15 + s.phase)))));
    };
  }
};
