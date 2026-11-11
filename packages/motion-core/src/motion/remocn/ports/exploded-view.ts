import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'exploded-view',
  title: 'Exploded view',
  about: 'An isometric stack of slabs lifts apart with leader lines and labels, then clicks back together.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 70,
  background: '#111111',
  fonts: ['Inter'],
  props: {
    labels: { type: 'string', title: 'Labels (comma-separated)', default: 'Interface, Engine, Storage, Hardware', group: 'Content', maxLength: 200 },
    layers: { type: 'number', title: 'Slabs', default: 4, minimum: 2, maximum: 6, step: 1, group: 'Style' },
    highlight: { type: 'number', title: 'Highlighted slab', default: 1, minimum: 0, maximum: 5, step: 1, group: 'Style' },
    labelColor: { type: 'string', title: 'Labels', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const speed = Number(p.speed);
    const labelColor = String(p.labelColor);
    const highlight = Number(p.highlight);
    const n = Math.round(Math.min(6, Math.max(2, Number(p.layers))));
    const labels = String(p.labels).split(',').map((l) => l.trim());
    const face = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const C = { top: '#F4F4F4', left: '#A6A6A6', right: '#747474', hotTop: '#E5322D', hotLeft: '#B5231F', hotRight: '#8A1A17', line: '#FFFFFF' };
    const OPEN = 3;
    const CLOSE = 38;
    const COS30 = Math.cos(Math.PI / 6);
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const side = height * 0.36;
    const thick = height * 0.036;
    const gap = (height * 0.27) / (n - 1);
    const cx = width * 0.4;
    const cy = height * 0.5;
    const labelX = width * 0.66;
    const fontSize = height * 0.042;
    const h = side / 2;
    const inset = h * 0.78;

    const iso = (X: number, Y: number, Z: number): [number, number] => [(X - Y) * COS30, (X + Y) * 0.5 - Z];
    const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }) as SVGElement;
    view.root.style.overflow = 'hidden';
    view.root.replaceChildren(svg);

    return (at) => {
      const t = (at * speed * 30) / view.fps;
      const close = S.spring({ frame: t - CLOSE, fps: 30, config: { damping: 26, stiffness: 320, mass: 0.8 } });
      const spread = Array.from({ length: n }, (_, i) => {
        const fromTop = n - 1 - i;
        const open = S.spring({ frame: t - OPEN - fromTop * 1.5, fps: 30, config: { damping: 12, stiffness: 110 } });
        return Math.max(0, open * (1 - close));
      });
      const offsets: number[] = [];
      let z = 0;
      for (let i = 0; i < n; i++) {
        offsets.push(z);
        z += thick + (i < n - 1 ? gap * Math.max(spread[i + 1], 0) : 0);
      }
      const total = z;
      const knock = S.interpolate(t, [CLOSE + 5, CLOSE + 7, CLOSE + 12], [0, 1, 0], { ...clamp, easing: S.Easing.out(S.Easing.quad) }) * height * 0.008;
      const baseY = cy + side * 0.02 + total / 2 + knock;
      const labelOut = S.interpolate(t, [CLOSE - 5, CLOSE], [1, 0], clamp);

      const slabs: Element[] = [];
      const leaders: Element[] = [];
      for (let i = 0; i < n; i++) {
        const fromTop = n - 1 - i;
        const hot = fromTop === highlight;
        const z0 = offsets[i];
        const z1 = z0 + thick;
        const top = [iso(-h, -h, z1), iso(h, -h, z1), iso(h, h, z1), iso(-h, h, z1)];
        const left = [iso(-h, h, z1), iso(h, h, z1), iso(h, h, z0), iso(-h, h, z0)];
        const right = [iso(h, -h, z1), iso(h, h, z1), iso(h, h, z0), iso(h, -h, z0)];
        const inner = [iso(-inset, -inset, z1), iso(inset, -inset, z1), iso(inset, inset, z1), iso(-inset, inset, z1)];
        const ink = hot ? '#FFFFFF' : '#111111';
        const bars = [-0.4, 0, 0.4].map((k) => {
          const a = iso(-inset * 0.7, k * inset, z1);
          const b = iso(inset * (fromTop % 2 ? 0.2 : 0.7), k * inset, z1);
          return S.h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: ink, strokeOpacity: 0.22, strokeWidth: height * 0.006, strokeLinecap: 'round' });
        });
        slabs.push(S.h('g', null,
          S.h('polygon', { points: pts(left), fill: hot ? C.hotLeft : C.left }),
          S.h('polygon', { points: pts(right), fill: hot ? C.hotRight : C.right }),
          S.h('polygon', { points: pts(top), fill: hot ? C.hotTop : C.top }),
          S.h('polygon', { points: pts(inner), fill: 'none', stroke: ink, strokeOpacity: 0.18, strokeWidth: height * 0.002 }),
          ...bars
        ));

        const label = labels[fromTop];
        if (!label) {
          continue;
        }
        const anchor = iso(h, -h, (z0 + z1) / 2);
        const draw = S.interpolate(t, [14 + fromTop * 2.5, 24 + fromTop * 2.5], [0, 1], { ...clamp, easing: S.Easing.inOut(S.Easing.cubic) });
        const show = S.interpolate(t, [19 + fromTop * 2.5, 27 + fromTop * 2.5], [0, 1], { ...clamp, easing: S.Easing.out(S.Easing.cubic) }) * labelOut;
        const ax = cx + anchor[0] + height * 0.012;
        const ay = baseY + anchor[1];
        const length = (labelX - ax) * draw * labelOut;
        leaders.push(S.h('g', null,
          S.h('circle', { cx: ax, cy: ay, r: height * 0.006, fill: C.line, opacity: Math.min(1, draw * 3) * labelOut }),
          S.h('line', { x1: ax, y1: ay, x2: ax + length, y2: ay, stroke: C.line, strokeOpacity: 0.6, strokeWidth: Math.max(1, height * 0.0022) }),
          S.h('g', { opacity: show, transform: `translate(${labelX + height * 0.02 + (1 - show) * height * 0.03} ${ay})` },
            S.h('text', { y: -fontSize * 0.62, fill: hot ? C.hotTop : labelColor, fillOpacity: hot ? 1 : 0.5, fontFamily: face, fontSize: fontSize * 0.5, fontWeight: 600, letterSpacing: '0.12em' }, `0${fromTop + 1}`),
            S.h('text', { y: fontSize * 0.42, fill: labelColor, fontFamily: face, fontSize, fontWeight: 700, letterSpacing: '-0.02em' }, label)
          )
        ));
      }

      svg.replaceChildren(
        S.h('ellipse', { cx, cy: baseY + side * 0.5 + height * 0.035, rx: side * COS30 * 1.05, ry: side * 0.16, fill: '#000000', opacity: 0.5 }),
        S.h('g', { transform: `translate(${cx} ${baseY})` }, ...slabs),
        ...leaders
      );
    };
  }
};
