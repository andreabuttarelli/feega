import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'strikethrough-replace',
  title: 'Strikethrough replace',
  about: 'A word gets struck out by a bold line, then a replacement word fades up beside it.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'strikethrough-replace',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#f7f7f8',
  fonts: ['Inter'],
  props: {
    before: { type: 'string', title: 'Struck word', default: 'Slow', group: 'Content', maxLength: 30 },
    after: { type: 'string', title: 'Replacement word', default: 'Fast', group: 'Content', maxLength: 30 },
    origin: { type: 'string', title: 'Origin', default: 'left', enum: ['left', 'center', 'right'], group: 'Motion' },
    thickness: { type: 'string', title: 'Thickness', default: 'standard', enum: ['thin', 'standard', 'thick'], group: 'Style' },
    tint: { type: 'string', title: 'Tint', default: 'red', enum: ['red', 'amber', 'blue', 'violet'], group: 'Style' },
    tone: { type: 'string', title: 'Tone', default: 'ink', enum: ['ink', 'paper'], group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const ZOOM = 2.8;
    const origins = { left: '0% 50%', center: '50% 50%', right: '100% 50%' };
    const thicknesses = { thin: 3, standard: 6, thick: 10 };
    const tints = { red: '#ef4444', amber: '#f59e0b', blue: '#38bdf8', violet: '#a78bfa' };
    const tones = { ink: '#18181b', paper: '#fafafa' };
    const strike = S.h('i', { style: { position: 'absolute', left: 0, width: '48%', height: thicknesses[String(p.thickness)] || 6, borderRadius: 999, background: tints[String(p.tint)] || tints.red, transformOrigin: origins[String(p.origin)] || origins.left } }) as HTMLElement;
    const next = S.h('strong', { style: { fontWeight: 900 } }, String(p.after)) as HTMLElement;
    const pair = S.h('div', { style: { position: 'relative', display: 'inline-grid', gridAutoFlow: 'column', gap: 18, alignItems: 'center', fontSize: 58, color: tones[String(p.tone)] || tones.ink, fontFamily: 'Inter, sans-serif', fontWeight: 900, letterSpacing: '-0.04em', transform: 'scale(' + ZOOM + ')' } }, S.h('span', null, String(p.before)), strike, next);
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, pair);
    view.root.replaceChildren(stage);

    const START = 0.5;
    const tl = S.timeline();
    tl.set(strike, { scaleX: 0 }, 0);
    tl.set(next, { opacity: 0, y: 14 }, 0);
    tl.to(strike, { scaleX: 1, duration: 0.28, ease: 'power2.out' }, START);
    tl.to(next, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, START + 0.24);

    return (frame) => tl.render(frame / view.fps);
  }
};
