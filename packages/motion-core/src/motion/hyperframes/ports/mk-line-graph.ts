import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-line-graph',
  title: 'Minimal line graph',
  about: 'One or two lines draw across a faint baseline, dots pop in along the draw front and value labels rise beside them.',
  category: HfCategory.Chart,
  origin: HfOrigin.Block,
  source: 'mk-line-graph',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 210,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    nameA: { type: 'string', title: 'Series 1 name', default: 'Renders', group: 'Content', maxLength: 30 },
    valuesA: { type: 'string', title: 'Series 1 values', default: '12, 26, 22, 38, 44, 58', description: 'Comma separated numbers.', group: 'Content', maxLength: 200 },
    nameB: { type: 'string', title: 'Series 2 name', default: 'Projects', group: 'Content', maxLength: 30 },
    valuesB: { type: 'string', title: 'Series 2 values', default: '8, 14, 18, 16, 28, 36', description: 'Comma separated numbers, empty for a single series.', group: 'Content', maxLength: 200 },
    xLabels: { type: 'string', title: 'X labels', default: 'Jan, Feb, Mar, Apr, May, Jun', description: 'Comma separated.', group: 'Content', maxLength: 200 },
    colorA: { type: 'string', title: 'Series 1 colour', format: PropFormat.Color, default: '#0071e3', group: 'Style' },
    colorB: { type: 'string', title: 'Series 2 colour', format: PropFormat.Color, default: '#45d6c8', group: 'Style' },
    ink: { type: 'string', title: 'Value colour', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' },
    dim: { type: 'string', title: 'Label colour', format: PropFormat.Color, default: '#6e6e73', group: 'Style' },
    paper: { type: 'string', title: 'Dot fill', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const DUR = 7;
    const DRAW = 1.3;
    const A = { x: 160, y: 240, w: 980, h: 500 };
    const nums = (text: unknown) => String(text).split(',').map((s) => parseFloat(s)).filter((v) => isFinite(v));
    const series = [
      { name: String(p.nameA), color: String(p.colorA), values: nums(p.valuesA) },
      { name: String(p.nameB), color: String(p.colorB), values: nums(p.valuesB) }
    ].filter((s) => s.values.length > 1);
    if (series.length === 0) {
      view.root.replaceChildren();
      return () => undefined;
    }
    const n = series[0].values.length;
    const xLabels = String(p.xLabels).split(',').map((s) => s.trim()).slice(0, n);
    const max = Math.max(...series.flatMap((s) => s.values)) * 1.15;
    const px = (i: number) => A.x + (i / (n - 1)) * A.w;
    const py = (v: number) => A.y + A.h - (v / max) * A.h;
    const font = 'Inter, -apple-system, sans-serif';

    const axis = S.h('line', { x1: A.x - 20, y1: A.y + A.h, x2: A.x + A.w + 20, y2: A.y + A.h, stroke: 'rgba(29, 29, 31, 0.22)', 'stroke-width': 2 }) as SVGElement;
    const svgKids: Element[] = [axis];
    const labelKids: Element[] = [];
    const paths: { el: SVGElement; len: number; s: (typeof series)[number] }[] = [];
    const dots: { el: SVGElement; val: HTMLElement; si: number; i: number }[] = [];

    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [px(i), py(v)]);
      const len = pts.slice(1).reduce((acc, pt, i) => acc + Math.hypot(pt[0] - pts[i][0], pt[1] - pts[i][1]), 0);
      const d = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ' ' + pt[1]).join(' ');
      const path = S.h('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) as SVGElement;
      svgKids.push(path);
      paths.push({ el: path, len, s });
      s.values.forEach((v, i) => {
        const dot = S.h('circle', { cx: pts[i][0], cy: pts[i][1], r: 9, fill: String(p.paper), stroke: s.color, 'stroke-width': 4, style: { transformBox: 'fill-box', transformOrigin: '50% 50%' } }) as SVGElement;
        const below = si > 0;
        const val = S.h('div', { style: { position: 'absolute', left: pts[i][0], top: pts[i][1] + (below ? 22 : -(22 + 38)), fontWeight: 600, fontSize: 30, letterSpacing: '-0.01em', color: String(p.ink), fontVariantNumeric: 'tabular-nums', transform: 'translate(-50%, 0)', lineHeight: '38px', whiteSpace: 'nowrap' } }, String(v)) as HTMLElement;
        svgKids.push(dot);
        labelKids.push(val);
        dots.push({ el: dot, val, si, i });
      });
    });

    const xEls = xLabels.map((t, i) => S.h('div', { style: { position: 'absolute', left: px(i), top: A.y + A.h + 24, fontWeight: 400, fontSize: 26, color: String(p.dim), transform: 'translateX(-50%)', whiteSpace: 'nowrap' } }, t) as HTMLElement);
    const legend = S.h('div', { style: { position: 'absolute', left: A.x, top: A.y + A.h + 90, display: 'flex', gap: 40 } },
      ...series.map((s) => S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, fontSize: 30, color: String(p.dim) } }, S.h('span', { style: { width: 14, height: 14, borderRadius: '50%', background: s.color } }), s.name))
    ) as HTMLElement;

    const svg = S.h('svg', { viewBox: '0 0 1920 1080', style: { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 } }, ...svgKids) as SVGElement;
    const labels = S.h('div', { style: { position: 'absolute', left: 0, top: 0 } }, ...labelKids, ...xEls, legend) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, fontFamily: font } }, svg, labels) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set([axis, legend], { opacity: 0 }, 0);
    tl.to(axis, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.2);
    xEls.forEach((xl, i) => {
      tl.set(xl, { opacity: 0, y: 10 }, 0);
      tl.to(xl, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.25 + i * 0.05);
    });
    paths.forEach(({ el, len }, si) => {
      const t0 = 0.5 + si * 0.35;
      tl.set(el, { strokeDasharray: len, strokeDashoffset: len }, 0);
      tl.to(el, { strokeDashoffset: 0, duration: DRAW, ease: 'power2.inOut' }, t0);
    });
    dots.forEach(({ el, val, si, i }) => {
      const td = 0.5 + si * 0.35 + (i / (n - 1)) * DRAW * 0.92;
      tl.set(el, { scale: 0 }, 0);
      tl.set(val, { opacity: 0, y: 8 }, 0);
      tl.to(el, { scale: 1, duration: 0.35, ease: 'back.out(1.2)' }, td);
      tl.to(val, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, td + 0.06);
    });
    tl.to(legend, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 2.3);
    tl.to([svg, labels], { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' }, DUR - 0.5);
    tl.set(wrap, { visibility: 'hidden' }, DUR - 0.02);

    return (frame) => tl.render(frame / view.fps);
  }
};
