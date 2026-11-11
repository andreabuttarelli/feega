import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'conic-progress-ring',
  title: 'Progress ring',
  about: 'A thin ring fills clockwise to a target percentage while the number in the middle counts up, then everything fades out.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'conic-progress-ring',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0b1220',
  fonts: ['Inter'],
  props: {
    progress: { type: 'number', title: 'Progress', default: 100, minimum: 0, maximum: 100, group: 'Content' },
    thickness: { type: 'number', title: 'Thickness', default: 12, minimum: 4, maximum: 30, group: 'Style' },
    label: { type: 'string', title: 'Label', default: '100', group: 'Content', maxLength: 24 },
    ring: { type: 'string', title: 'Ring', format: PropFormat.Color, default: '#35d6a0', group: 'Style' },
    track: { type: 'string', title: 'Track', format: PropFormat.Color, default: '#1b2938', group: 'Style' },
    ink: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#f4f7fb', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const num = Number(p.progress);
    const target = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 100;
    const thick = Number(p.thickness);
    const thickness = Number.isFinite(thick) ? Math.max(4, Math.min(30, thick)) : 12;
    const text = p.label == null ? '100' : String(p.label);
    const match = text.trim().match(/^(-?\d+(?:\.\d+)?)(.*)$/);
    const labelTarget = match ? Number(match[1]) : null;
    const suffix = match ? match[2] : '';
    const ink = String(p.ink);
    const side = Math.min(view.width, view.height) * 0.68;

    const cut = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}%), ${ink} 0)`;
    const ring = S.h('div', { style: { position: 'absolute', inset: 0, borderRadius: '50%' } }) as HTMLElement;
    ring.style.setProperty('-webkit-mask', cut);
    ring.style.setProperty('mask', cut);
    const label = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: ink, fontSize: Math.min(view.width, view.height) * 0.18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1, textAlign: 'center' } }) as HTMLElement;
    const stage = S.h('div', { style: { position: 'relative', width: side, height: side } }, ring, label) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Inter, system-ui, sans-serif' } }, stage);
    view.root.replaceChildren(clip);

    const paint = (fill: number) => {
      ring.style.background = `conic-gradient(from -90deg, ${String(p.ring)} 0 ${fill}%, ${String(p.track)} ${fill}% 100%)`;
      const ratio = target > 0 ? fill / target : 1;
      label.textContent = labelTarget === null ? text : Math.round(labelTarget * ratio) + suffix;
    };
    paint(0);

    const IN = 1.4;
    const OUT = 0.5;
    const duration = view.frames / view.fps;
    const fit = Math.min(1, duration / (IN + OUT));
    const inT = IN * fit;
    const outT = OUT * fit;
    const outAt = inT + Math.max(0, duration - inT - outT);
    const prog = { v: 0 };

    const tl = S.timeline();
    tl.to(prog, { v: target, duration: inT, ease: 'power2.out', onUpdate: () => paint(prog.v) }, 0);
    tl.to(stage, { opacity: 0, duration: outT, ease: 'power2.in' }, outAt);

    return (frame) => tl.render(frame / view.fps);
  }
};
