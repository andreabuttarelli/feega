import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'pendulum-wave',
  title: 'Pendulum wave',
  about: 'A row of pendulums with slightly different periods drift in and out of phase, forming travelling waves before realigning on the loop.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 450,
  background: '#111111',
  fonts: [],
  props: {
    count: { type: 'number', title: 'Pendulums', default: 15, minimum: 2, maximum: 40, step: 1, group: 'Content' },
    cycles: { type: 'number', title: 'Swings of the slowest', default: 10, minimum: 1, maximum: 30, step: 1, group: 'Content' },
    showGuides: { type: 'boolean', title: 'Guides', default: true, group: 'Style' },
    color: { type: 'string', title: 'Bobs', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Wave line', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    loopFrames: { type: 'number', title: 'Loop frames', default: 450, minimum: 90, maximum: 900, step: 30, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const TAU = Math.PI * 2;
    const SMEAR_FRAMES = 4;
    const SMEAR_SAMPLES = 6;
    const n = Math.max(2, Math.round(Number(p.count)));
    const cycles = Number(p.cycles);
    const loop = Math.max(1, Number(p.loopFrames));
    const speed = Number(p.speed);
    const color = String(p.color);
    const accent = String(p.accent);
    const marginX = W * 0.1;
    const gap = (W - marginX * 2) / (n - 1);
    const amp = H * 0.3;
    const cy = H / 2;
    const r0 = Math.min(gap * 0.3, H * 0.022);
    const unit = Math.min(W, H) / 720;
    const fmt = (v: number) => Math.round(v * 10) / 10;
    const circle = (x: number, y: number, r: number) => `M ${fmt(x - r)} ${fmt(y)} a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0 a ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0`;
    const phaseAt = (i: number, t: number) => (TAU * t * (cycles + i)) / loop;
    const smoothPath = (pts: { x: number; y: number }[]) => {
      let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        d += ` C ${fmt(p1.x + (p2.x - p0.x) / 6)} ${fmt(p1.y + (p2.y - p0.y) / 6)} ${fmt(p2.x - (p3.x - p1.x) / 6)} ${fmt(p2.y - (p3.y - p1.y) / 6)} ${fmt(p2.x)} ${fmt(p2.y)}`;
      }
      return d;
    };

    const xs = Array.from({ length: n }, (_, i) => marginX + i * gap);
    const centre = S.h('path', { d: `M ${fmt(marginX - gap)} ${cy} H ${fmt(W - marginX + gap)}`, strokeOpacity: 0.14, strokeWidth: unit });
    const tracks = S.h('path', { d: xs.map((x) => `M ${fmt(x)} ${fmt(cy - amp)} V ${fmt(cy + amp)}`).join(' '), strokeOpacity: 0.08, strokeWidth: unit, strokeDasharray: `${2 * unit} ${6 * unit}` });
    const ticks = S.h('path', { d: xs.map((x) => circle(x, cy - amp, 2.2 * unit) + ' ' + circle(x, cy + amp, 2.2 * unit)).join(' '), fill: color, fillOpacity: 0.25, stroke: 'none' });
    const guides = S.h('g', { stroke: color, fill: 'none' }, centre, tracks, ticks);
    const wave = S.h('path', { fill: 'none', stroke: accent, strokeWidth: 2.5 * unit, strokeLinecap: 'round', strokeOpacity: 0.85 });
    const smearPath = S.h('path', { fill: 'none', stroke: color, strokeOpacity: 0.13, strokeWidth: r0 * 0.9, strokeLinecap: 'round', strokeLinejoin: 'round' });
    const bobPath = S.h('path', { fill: color });
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } }, p.showGuides ? guides : null, wave, smearPath, bobPath);
    view.root.replaceChildren(S.fill({}, svg));

    return (at) => {
      const time = at * speed;
      const bobs = xs.map((x, i) => {
        const c = Math.cos(phaseAt(i, time));
        return { x, y: cy - amp * c, r: r0 * (1 - 0.22 * c) };
      });
      let smear = '';
      for (let i = 0; i < n; i++) {
        const x = fmt(bobs[i].x);
        for (let s = 0; s <= SMEAR_SAMPLES; s++) {
          const t = time - (SMEAR_FRAMES * speed * s) / SMEAR_SAMPLES;
          smear += `${s === 0 ? 'M' : 'L'} ${x} ${fmt(cy - amp * Math.cos(phaseAt(i, t)))} `;
        }
      }
      wave.setAttribute('d', smoothPath(bobs));
      smearPath.setAttribute('d', smear);
      bobPath.setAttribute('d', bobs.map((b) => circle(b.x, b.y, b.r)).join(' '));
    };
  }
};
