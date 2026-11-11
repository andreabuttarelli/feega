import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'success-check',
  title: 'Success check',
  about: 'A round halo holds a tick mark that swings and blurs into focus while the tick draws itself.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'success-check',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    tint: { type: 'string', title: 'Tint', enum: ['green', 'blue', 'violet', 'amber'], default: 'green', group: 'Style' },
    size: { type: 'string', title: 'Size', enum: ['small', 'standard', 'large'], default: 'standard', group: 'Layout' },
    ring: { type: 'string', title: 'Ring', enum: ['subtle', 'standard', 'bold'], default: 'standard', group: 'Style' },
    spin: { type: 'string', title: 'Spin', enum: ['subtle', 'standard', 'bold'], default: 'standard', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const ZOOM = 3;
    const DASH = 36;
    const TINTS: Record<string, string[]> = { green: ['#dcfce7', '#16a34a'], blue: ['#f4f4f5', '#2563eb'], violet: ['#f4f4f5', '#7c3aed'], amber: ['#fef3c7', '#d97706'] };
    const SIZES: Record<string, number[]> = { small: [60, 47], standard: [82, 64], large: [110, 86] };
    const RINGS: Record<string, number> = { subtle: 0.12, standard: 0.28, bold: 0.6 };
    const SPINS: Record<string, number> = { subtle: 0.4, standard: 1, bold: 2 };
    const [halo, ink] = TINTS[String(p.tint)] ?? TINTS.green;
    const [box, mark] = SIZES[String(p.size)] ?? SIZES.standard;
    const ring = RINGS[String(p.ring)] ?? RINGS.standard;
    const spin = SPINS[String(p.spin)] ?? SPINS.standard;

    const tick = S.h('path', { d: 'M20 33.5l8 8L45 23', style: { strokeDasharray: String(DASH) } }) as SVGElement;
    const svg = S.h('svg', { viewBox: '0 0 64 64', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round', style: { width: mark, height: mark } }, S.h('circle', { cx: 32, cy: 32, r: 27, style: { opacity: ring } }), tick) as SVGElement;
    const disc = S.h('div', { style: { display: 'grid', placeItems: 'center', width: box, height: box, borderRadius: 999, background: halo, color: ink, transform: `scale(${ZOOM})` } }, svg);
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, disc);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.fromTo(svg, { opacity: 0, scale: 0.72, rotation: -18 * spin, filter: 'blur(7px)' }, { opacity: 1, scale: 1, rotation: 0, filter: 'blur(0px)', duration: 0.34, ease: 'back.out(1.8)' }, 0.3);
    tl.fromTo(tick, { strokeDashoffset: DASH }, { strokeDashoffset: 0, duration: 0.42, ease: 'power2.out' }, 0.42);

    return (frame) => tl.render(frame / view.fps);
  }
};
