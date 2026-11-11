import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'decline-chart',
  title: 'Decline chart',
  about: 'A red line draws itself downward while a big number falls from its start to its end value and the dark background dims.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'decline-chart',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0c1118',
  fonts: ['Inter'],
  props: {
    label: { type: 'string', title: 'Label', default: 'Retention', group: 'Content', maxLength: 40 },
    start_value: { type: 'number', title: 'Start value', default: 82, minimum: 0, maximum: 100, group: 'Content' },
    end_value: { type: 'number', title: 'End value', default: 34, minimum: 0, maximum: 100, group: 'Content' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const startValue = Number.isFinite(Number(p.start_value)) ? Number(p.start_value) : 82;
    const endValue = Number.isFinite(Number(p.end_value)) ? Number(p.end_value) : 34;
    const font = 'Inter, system-ui, sans-serif';

    const ambient = S.h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 24% 16%, rgba(47, 129, 150, 0.55), transparent 46%), linear-gradient(145deg, #152f3c 0%, #101a25 48%, #0c1118 100%)', transform: 'scale(1.02)', transformOrigin: 'center' } }) as HTMLElement;
    const gloom = S.h('div', { style: { position: 'absolute', inset: 0, background: '#030507' } }) as HTMLElement;
    const label = S.h('div', { style: { maxWidth: W * 0.58, overflow: 'hidden', color: 'rgba(226, 232, 240, 0.72)', fontSize: 38, fontWeight: 620, letterSpacing: '0.05em', lineHeight: 1.1, textOverflow: 'ellipsis', textTransform: 'uppercase', whiteSpace: 'nowrap' } }, String(p.label ?? '')) as HTMLElement;
    const value = S.h('div', { style: { flex: '0 0 auto', color: '#f8fafc', fontSize: 118, fontVariantNumeric: 'tabular-nums', fontWeight: 760, letterSpacing: '-0.07em', lineHeight: 0.8 } }) as HTMLElement;
    const grid = (y: number) => S.h('line', { x1: 8, y1: y, x2: 252, y2: y, stroke: 'rgba(148, 163, 184, 0.18)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' });
    const line = S.h('path', { d: 'M 8 24 C 28 28, 44 43, 61 56 S 93 76, 112 92 S 144 111, 163 134 S 193 159, 213 186 S 239 211, 252 222', pathLength: 1, fill: 'none', stroke: '#fb7185', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: '1 1' }) as SVGElement;
    const endpoint = S.h('circle', { cx: 252, cy: 222, r: 6, fill: '#fecdd3', style: { transformBox: 'fill-box', transformOrigin: 'center' } }) as SVGElement;
    const chart = S.h('svg', { viewBox: '0 0 260 240', preserveAspectRatio: 'none', style: { width: '100%', height: '100%', overflow: 'visible' } }, grid(55), grid(120), grid(185), line, endpoint);
    const header = S.h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: W * 0.05 } }, label, value);
    const layout = S.h('div', { style: { position: 'absolute', top: H * 0.09, left: W * 0.09, right: W * 0.09, bottom: H * 0.08, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: H * 0.05, opacity: 0 } }, header, chart) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: font } }, ambient, gloom, layout);
    view.root.replaceChildren(clip);

    const draw = (q: number) => {
      line.style.strokeDashoffset = String(1 - q);
      ambient.style.filter = `saturate(${1 - q * 0.72}) brightness(${1 - q * 0.52})`;
      gloom.style.opacity = String(q * 0.46);
      endpoint.style.opacity = String(Math.max(0, (q - 0.94) / 0.06));
      value.textContent = String(Math.round(startValue + (endValue - startValue) * q));
    };
    draw(0);

    const IN = 0.55;
    const OUT = 0.45;
    const duration = view.frames / view.fps;
    const prog = { v: 0 };

    const tl = S.timeline();
    tl.set(layout, { opacity: 0, y: H * 0.025 }, 0);
    tl.set(endpoint, { scale: 0.72 }, 0);
    tl.to(layout, { opacity: 1, y: 0, duration: IN, ease: 'power2.out' }, 0);
    tl.to(prog, { v: 1, duration: duration - IN - OUT, ease: 'power2.out', onUpdate: () => draw(prog.v) }, IN);
    tl.to(endpoint, { scale: 1, duration: OUT, ease: 'power2.out' }, duration - OUT);

    return (frame) => tl.render(frame / view.fps);
  }
};
