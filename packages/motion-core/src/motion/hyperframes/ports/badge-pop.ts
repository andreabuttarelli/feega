import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'badge-pop',
  title: 'Badge pop',
  about: 'A bell tile slides up into view, then a round count badge pops onto its corner with a bounce and a small pulse.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'badge-pop',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#f4f4f5',
  fonts: ['Inter'],
  props: {
    count: { type: 'string', title: 'Count', default: '3', group: 'Content', maxLength: 4 },
    accent: { type: 'string', title: 'Accent', enum: ['red', 'blue', 'green', 'violet'], default: 'red', group: 'Style' },
    surface: { type: 'string', title: 'Surface', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const ZOOM = 3;
    const ACCENTS: Record<string, string> = { red: '#ef4444', blue: '#2563eb', green: '#16a34a', violet: '#7c3aed' };
    const SURFACES: Record<string, string[]> = { light: ['#ffffff', '#e4e4e7', '#18181b'], dark: ['#101014', '#2a2a32', '#fafafa'] };
    const accent = ACCENTS[String(p.accent)] ?? ACCENTS.red;
    const [surface, border, ink] = SURFACES[String(p.surface)] ?? SURFACES.light;
    const count = typeof p.count === 'string' && p.count.trim() ? p.count.trim().slice(0, 4) : '3';

    const icon = S.h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { width: 30, height: 30 } }, S.h('path', { d: 'M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7' }), S.h('path', { d: 'M10 20a2 2 0 004 0' }));
    const button = S.h('div', { style: { display: 'grid', placeItems: 'center', width: 76, height: 76, border: `1px solid ${border}`, borderRadius: 22, background: surface, color: ink, boxShadow: '0 20px 58px rgba(0, 0, 0, 0.12)' } }, icon) as HTMLElement;
    const badge = S.h('span', { style: { position: 'absolute', right: -8, top: -8, display: 'grid', placeItems: 'center', minWidth: 30, height: 30, padding: '0 8px', border: `3px solid ${surface}`, borderRadius: 999, background: accent, color: '#ffffff', fontSize: 13, fontWeight: 900, transformOrigin: 'center' } }, count) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'relative', display: 'inline-grid', placeItems: 'center', transform: `scale(${ZOOM})`, fontFamily: 'Inter, system-ui, sans-serif' } }, button, badge);
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, wrap);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.set(button, { y: 18, opacity: 0 }, 0);
    tl.set(badge, { scale: 0, opacity: 0 }, 0);
    tl.to(button, { y: 0, opacity: 1, duration: 0.34, ease: 'power2.out' }, 0.35);
    tl.to(badge, { scale: 1, opacity: 1, duration: 0.42, ease: 'back.out(2.4)' }, 0.7);
    tl.to(badge, { scale: 1.18, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 1.15);

    return (frame) => tl.render(frame / view.fps);
  }
};
