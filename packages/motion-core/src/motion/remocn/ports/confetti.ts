import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'confetti',
  title: 'Confetti',
  about: 'A seeded burst of fluttering confetti pieces fires from the centre, arcs under gravity and fades out.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#111111',
  fonts: [],
  props: {
    particleCount: { type: 'number', title: 'Particles', default: 140, minimum: 10, maximum: 400, step: 10, group: 'Content' },
    colors: { type: 'string', title: 'Colours (comma separated)', default: '#1d9bf0,#ff5da2,#ffd23f,#22c55e,#a855f7,#ff7a45', group: 'Style', maxLength: 200 },
    size: { type: 'number', title: 'Size', default: 13, minimum: 4, maximum: 30, step: 1, group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 1, minimum: 1, maximum: 9999, step: 1, group: 'Content' },
    power: { type: 'number', title: 'Power', default: 17, minimum: 4, maximum: 40, step: 1, group: 'Motion' },
    gravity: { type: 'number', title: 'Gravity', default: 0.45, minimum: 0, maximum: 1.5, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const LIFETIME = 90;
    const FADE_IN = 4;
    const FADE_OUT_START = 0.7;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const power = Number(p.power);
    const gravity = Number(p.gravity);
    const size = Number(p.size);
    const sc = view.height / 720;
    const ox = view.width * 0.5;
    const oy = view.height * 0.5;
    const parsed = String(p.colors).split(',').map((c) => c.trim()).filter(Boolean);
    const palette = parsed.length > 0 ? parsed : ['#1d9bf0', '#ff5da2', '#ffd23f', '#22c55e', '#a855f7', '#ff7a45'];

    let a = Number(p.seed) >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const parts = Array.from({ length: Math.max(0, Math.round(Number(p.particleCount))) }, () => {
      const angle = rand() * Math.PI * 2;
      const speed = 0.35 + 0.65 * rand();
      const color = palette[Math.floor(rand() * palette.length)];
      const scale = 0.7 + 0.6 * rand();
      const rot0 = rand() * Math.PI * 2;
      const spin = (rand() - 0.5) * 0.6;
      const drift = (rand() - 0.5) * 2;
      const w = size * scale * sc;
      const el = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: w, height: w * 0.62, borderRadius: 2, background: color } }) as HTMLElement;
      return { el, angle, speed, rot0, spin, drift, w };
    });
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, parts.map((q) => q.el)));

    return (tt) => {
      const opacity = tt < 0 || tt > LIFETIME ? 0 : Math.min(S.interpolate(tt, [0, FADE_IN], [0, 1], clamped), S.interpolate(tt, [LIFETIME * FADE_OUT_START, LIFETIME], [1, 0], clamped));
      parts.forEach((q) => {
        q.el.style.opacity = String(opacity);
        const vx = Math.cos(q.angle) * q.speed * power + q.drift;
        const vy = Math.sin(q.angle) * q.speed * power;
        const x = ox + vx * tt * sc;
        const y = oy + (vy * tt + 0.5 * gravity * tt * tt) * sc;
        q.el.style.transform = `translate(${x - q.w / 2}px, ${y - q.w * 0.31}px) rotate(${q.rot0 + q.spin * tt}rad) scale(${Math.cos(q.rot0 + q.spin * tt * 1.6)}, 1)`;
      });
    };
  }
};
