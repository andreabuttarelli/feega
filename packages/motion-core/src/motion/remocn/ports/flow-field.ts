import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'flow-field',
  title: 'Flow field',
  about: 'Hundreds of particles trace fading trails along a slowly evolving noise-like flow field that loops seamlessly.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#111111',
  fonts: [],
  props: {
    particles: { type: 'number', title: 'Particles', default: 300, minimum: 50, maximum: 800, step: 10, group: 'Motion' },
    trailLength: { type: 'number', title: 'Trail length', default: 72, minimum: 8, maximum: 120, step: 1, group: 'Motion' },
    strokeWidth: { type: 'number', title: 'Stroke width', default: 1.4, minimum: 0.5, maximum: 4, step: 0.1, group: 'Style' },
    accentRatio: { type: 'number', title: 'Accent share', default: 0.1, minimum: 0, maximum: 1, step: 0.05, group: 'Style' },
    loopFrames: { type: 'number', title: 'Loop frames', default: 300, minimum: 120, maximum: 600, step: 30, group: 'Motion' },
    seed: { type: 'number', title: 'Seed', default: 1, minimum: 1, maximum: 50, step: 1, group: 'Motion' },
    color: { type: 'string', title: 'Trails', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#E5322D', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const seed = Number(p.seed);
    const particles = Number(p.particles);
    const accentRatio = Number(p.accentRatio);
    const TAU = Math.PI * 2;
    const WAVES = 4;
    const STEP = 0.0042;
    const BUCKETS = 6;
    const LIFE_FRAMES = 150;
    const MARGIN = 0.08;

    const r = (key: string) => S.random(`flow-field-${seed}-${key}`);
    const base = r('base') * TAU;
    const waves = Array.from({ length: WAVES }, (_, k) => ({
      fx: (r(`fx${k}`) * 2 - 1) * (0.9 + k * 0.8),
      fy: (r(`fy${k}`) * 2 - 1) * (0.9 + k * 0.8),
      phase: r(`ph${k}`) * TAU,
      drift: 0.6 + r(`dr${k}`) * 0.9,
      amp: 1.6 / (1 + k * 1.4)
    }));
    const field = (x: number, y: number, tau: number) => {
      let a = base;
      for (const w of waves) {
        a += w.amp * Math.sin(w.fx * x + w.fy * y + w.phase + w.drift * Math.sin(tau + w.phase));
      }
      return a;
    };

    const unit = Math.min(width, height);
    const spanX = width / unit;
    const spanY = height / unit;
    const loop = Math.max(1, Math.round(Number(p.loopFrames)));
    const lives = Math.max(1, Math.round(loop / LIFE_FRAMES));
    const life = loop / lives;
    const trail = Math.max(2, Math.min(Number(p.trailLength), life * 0.6));
    const travel = life - trail;
    const sw = (Number(p.strokeWidth) * unit) / 720;
    const fmt = (n: number) => Math.round(n * 10) / 10;

    const layers = [String(p.color), String(p.accent)].map((paint) => {
      const group = S.h('g', { fill: 'none', stroke: paint, strokeLinecap: 'round', strokeLinejoin: 'round' });
      const paths = Array.from({ length: BUCKETS }, (_, b) => {
        const path = S.h('path', { strokeOpacity: 0.9 * (1 - b / BUCKETS) ** 1.4, strokeWidth: sw * (1 - (b / BUCKETS) * 0.5) });
        group.appendChild(path);
        return path;
      });
      return { group, paths };
    });
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${width} ${height}`, style: { display: 'block' } }, layers.map((l) => l.group));
    view.root.replaceChildren(svg);

    return (time) => {
      const d = layers.map(() => new Array<string>(BUCKETS).fill(''));
      const pts: number[] = [];

      for (let i = 0; i < particles; i++) {
        const offset = r(`off-${i}`) * life;
        const local = time + offset;
        const cycle = Math.floor(local / life);
        const age = local - cycle * life;
        const head = Math.min(age, travel);
        const tail = Math.max(0, age - trail);
        if (head - tail < 0.05) {
          continue;
        }

        const slot = ((cycle % lives) + lives) % lives;
        const key = `p${i}-c${slot}`;
        let x = -MARGIN + r(`${key}-x`) * (spanX + MARGIN * 2);
        let y = -MARGIN + r(`${key}-y`) * (spanY + MARGIN * 2);
        const birth = time - age;

        pts.length = 0;
        pts.push(x, y);
        const steps = Math.ceil(head);
        for (let s = 0; s < steps; s++) {
          const a = field(x, y, (TAU * (birth + s)) / loop);
          x += Math.cos(a) * STEP;
          y += Math.sin(a) * STEP;
          pts.push(x, y);
        }
        const at = (k: number) => {
          const j = Math.min(Math.floor(k), steps - 1);
          const f = k - j;
          if (j < 0) {
            return [pts[0], pts[1]];
          }
          return [pts[j * 2] + (pts[j * 2 + 2] - pts[j * 2]) * f, pts[j * 2 + 1] + (pts[j * 2 + 3] - pts[j * 2 + 1]) * f];
        };

        const target = r(`accent-${i}`) < accentRatio ? d[1] : d[0];
        for (let b = 0; b < BUCKETS; b++) {
          const from = Math.max(tail, age - (trail * (b + 1)) / BUCKETS);
          const to = Math.min(head, age - (trail * b) / BUCKETS);
          if (to - from <= 0.01) {
            continue;
          }
          const [fx, fy] = at(from);
          let seg = `M ${fmt(fx * unit)} ${fmt(fy * unit)}`;
          for (let k = Math.floor(from) + 1; k < to; k++) {
            seg += ` L ${fmt(pts[k * 2] * unit)} ${fmt(pts[k * 2 + 1] * unit)}`;
          }
          const [tx, ty] = at(to);
          seg += ` L ${fmt(tx * unit)} ${fmt(ty * unit)} `;
          target[b] += seg;
        }
      }

      layers.forEach((layer, li) => layer.paths.forEach((path, b) => path.setAttribute('d', d[li][b])));
    };
  }
};
