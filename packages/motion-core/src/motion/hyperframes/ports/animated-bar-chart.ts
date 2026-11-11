import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'animated-bar-chart',
  title: 'Animated bar chart',
  about: 'A white data card: seven bars grow from the baseline while a curved trend line draws across them, next to a big percentage.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'animated-bar-chart',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#e5e7eb',
  fonts: ['Inter'],
  props: {
    title: { type: 'string', title: 'Title', default: 'Animated Bar Chart', group: 'Content', maxLength: 40 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'A compact data card with deterministic bar growth and value callouts.', group: 'Content', maxLength: 120 },
    value: { type: 'string', title: 'Value', default: '+42%', group: 'Content', maxLength: 12 },
    ink: { type: 'string', title: 'Ink', format: PropFormat.Color, default: '#111827', group: 'Style' },
    card: { type: 'string', title: 'Card', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const HEIGHTS = [42, 72, 56, 88, 64, 95, 78];
    const BAR_AREA = 210;
    const DASH = 900;
    const ink = String(p.ink);

    const bars = HEIGHTS.map(() => S.h('span', { style: { display: 'block', borderRadius: '14px 14px 5px 5px', background: ink, opacity: 0.72 } }) as HTMLElement);
    const row = S.h('div', { style: { height: BAR_AREA, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'end', gap: 14 } }, ...bars);
    const path = S.h('path', { d: 'M20 172 C120 90, 190 118, 260 74 S430 112, 508 42 S620 82, 680 30', fill: 'none', stroke: ink, strokeWidth: 10, strokeLinecap: 'round', style: { opacity: 0.45, strokeDasharray: String(DASH) } }) as SVGElement;
    const trend = S.h('svg', { viewBox: '0 0 700 210', style: { width: '100%', height: 210, overflow: 'visible' } }, path);
    const head = S.h(
      'header',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
      S.h('div', null, S.h('div', { style: { margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em' } }, String(p.title)), S.h('div', { style: { margin: '16px 0', fontSize: 16 } }, String(p.subtitle))),
      S.h('strong', { style: { fontSize: 54, letterSpacing: '-0.06em' } }, String(p.value))
    );
    const card = S.h('div', { style: { width: 760, minHeight: 420, borderRadius: 28, background: String(p.card), padding: 34, boxShadow: '0 28px 80px rgba(15, 23, 42, 0.16)', display: 'grid', gap: 22, color: ink, fontFamily: 'Inter, system-ui, sans-serif' } }, head, row, trend);
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, card);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    bars.forEach((bar, i) => {
      tl.fromTo(bar, { height: 0 }, { height: (HEIGHTS[i] / 100) * BAR_AREA, duration: 1.2, ease: 'power3.out' }, 0.3);
    });
    tl.fromTo(path, { strokeDashoffset: DASH }, { strokeDashoffset: 0, duration: 1.2, ease: 'power3.out' }, 0.3);

    return (frame) => tl.render(frame / view.fps);
  }
};
