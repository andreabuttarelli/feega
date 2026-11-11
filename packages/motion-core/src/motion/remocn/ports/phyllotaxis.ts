import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'phyllotaxis',
  title: 'Phyllotaxis',
  about: 'A sunflower spiral of seeds placed at the golden angle pops outward, then an accent arm lights up and pulses.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 165,
  background: '#111111',
  fonts: [],
  props: {
    count: { type: 'number', title: 'Seeds', default: 420, minimum: 50, maximum: 1200, step: 10, group: 'Content' },
    arm: { type: 'number', title: 'Arm spacing', default: 21, minimum: 1, maximum: 89, step: 1, group: 'Content' },
    size: { type: 'number', title: 'Seed size', default: 1, minimum: 0.3, maximum: 2, step: 0.05, group: 'Style' },
    color: { type: 'string', title: 'Seeds', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Arm', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    growFrames: { type: 'number', title: 'Grow frames', default: 60, minimum: 15, maximum: 150, step: 5, group: 'Motion' },
    pulseFrames: { type: 'number', title: 'Pulse frames', default: 45, minimum: 15, maximum: 120, step: 5, group: 'Motion' },
    rotation: { type: 'number', title: 'Rotation (deg/s)', default: 4, minimum: -30, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const GOLDEN = (137.508 * Math.PI) / 180;
    const POP = 10;
    const pop = S.Easing.out(S.Easing.back(2.2));
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const fmt = (v: number) => Math.round(v * 10) / 10;
    const dot = (x: number, y: number, r: number) => `M ${fmt(x - r)} ${fmt(y)} a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0 a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0 `;
    const n = Math.max(1, Math.round(Number(p.count)));
    const step = Math.max(1, Math.round(Number(p.arm)));
    const size = Number(p.size);
    const growFrames = Number(p.growFrames);
    const pulseFrames = Number(p.pulseFrames);
    const rotation = Number(p.rotation);
    const speed = Number(p.speed);
    const cx = W / 2;
    const cy = H / 2;
    const c = (Math.min(W, H) * 0.44) / Math.sqrt(n);

    const plainPath = S.h('path', { fill: String(p.color) });
    const spinePath = S.h('path', { fill: 'none', stroke: String(p.accent), strokeWidth: Math.min(W, H) / 720 });
    const redBase = S.h('path', { fill: String(p.color) });
    const redTop = S.h('path', { fill: String(p.accent) });
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } }, plainPath, spinePath, redBase, redTop);
    view.root.replaceChildren(S.fill({}, svg));

    return (at) => {
      const time = at * speed;
      const spin = (rotation * Math.PI * time) / 180 / view.fps;
      const armIn = S.interpolate(time, [growFrames, growFrames + 14], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) });
      const since = time - growFrames - 10;
      const pulse = since > 0 ? (since / Math.max(1, pulseFrames)) % 1 : -1;
      let plain = '';
      let red = '';
      let spine = '';
      for (let i = 1; i <= n; i++) {
        const s = pop(Math.min(1, Math.max(0, (time - growFrames * Math.sqrt(i / n)) / POP)));
        if (s <= 0) {
          continue;
        }
        const radius = c * Math.sqrt(i);
        const theta = i * GOLDEN + spin;
        const x = cx + Math.cos(theta) * radius;
        const y = cy + Math.sin(theta) * radius;
        const base = c * 0.42 * size * (0.55 + 0.45 * Math.sqrt(i / n));
        if (!(i % step === 0 && armIn > 0)) {
          plain += dot(x, y, base * s);
          continue;
        }
        const u = Math.sqrt(i / n);
        const bump = pulse >= 0 ? Math.exp(-(((u - pulse * 1.4 + 0.2) / 0.09) ** 2)) : 0;
        red += dot(x, y, base * s * (1 + 0.25 * armIn + bump * 0.9));
        spine += `${spine ? 'L' : 'M'} ${fmt(x)} ${fmt(y)} `;
      }
      plainPath.setAttribute('d', plain);
      spinePath.setAttribute('d', spine);
      spinePath.setAttribute('stroke-opacity', String(0.35 * armIn));
      redBase.setAttribute('d', red);
      redBase.setAttribute('fill-opacity', String(1 - armIn));
      redTop.setAttribute('d', red);
      redTop.setAttribute('fill-opacity', String(armIn));
    };
  }
};
