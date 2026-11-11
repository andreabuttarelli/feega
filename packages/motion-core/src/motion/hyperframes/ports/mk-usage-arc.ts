import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-usage-arc',
  title: 'Usage arc',
  about: 'A thin circular gauge draws on to a percentage while the number in its centre counts up, then it lifts away.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'mk-usage-arc',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    value: { type: 'number', title: 'Value', default: 76, minimum: 0, maximum: 100, group: 'Content' },
    label: { type: 'string', title: 'Label', default: 'Usage', group: 'Content', maxLength: 24 },
    color: { type: 'string', title: 'Arc colour', format: PropFormat.Color, default: '#0071e3', group: 'Style' },
    ink: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const R = 92;
    const C = 2 * Math.PI * R;
    const raw = Number(p.value);
    const value = (Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 76) / 100;
    const ink = String(p.ink);

    const track = S.h('circle', { cx: 110, cy: 110, r: R, fill: 'none', stroke: 'rgba(29, 29, 31, 0.1)', strokeWidth: 3 });
    const fill = S.h('circle', { cx: 110, cy: 110, r: R, transform: 'rotate(-90 110 110)', fill: 'none', stroke: String(p.color), strokeWidth: 3, strokeLinecap: 'round' }) as SVGElement;
    const svg = S.h('svg', { viewBox: '0 0 220 220', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }, track, fill);
    const num = S.h('span', { style: { fontWeight: 600, fontSize: 46, letterSpacing: '-0.02em', color: ink, fontVariantNumeric: 'tabular-nums' } }, '0%') as HTMLElement;
    const center = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 } }, num, S.h('span', { style: { fontWeight: 500, fontSize: 20, color: ink } }, String(p.label)));
    const arc = S.h('div', { style: { position: 'absolute', width: 220, height: 220, left: (view.width - 220) / 2, top: (view.height - 220) / 2, fontFamily: 'Inter, -apple-system, sans-serif' } }, svg, center) as HTMLElement;
    view.root.replaceChildren(arc);

    const st = { v: 0 };

    const tl = S.timeline();
    tl.set(arc, { opacity: 0, y: 16 }, 0);
    tl.set(fill, { strokeDasharray: C, strokeDashoffset: C }, 0);
    tl.to(arc, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.4);
    tl.to(fill, { strokeDashoffset: C * (1 - value), duration: 1.1, ease: 'power2.inOut' }, 0.55);
    tl.to(st, { v: value, duration: 1.1, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(st.v * 100) + '%'; } }, 0.55);
    tl.to(arc, { opacity: 0, y: -12, duration: 0.35, ease: 'power2.in' }, 3.4);

    return (frame) => tl.render(frame / view.fps);
  }
};
