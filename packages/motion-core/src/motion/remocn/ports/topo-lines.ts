import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'topo-lines',
  title: 'Topo lines',
  about: 'Evenly spaced topographic contour lines that breathe over drifting peaks, with an accent contour and heavier index lines.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#111111',
  fonts: [],
  props: {
    levels: { type: 'number', title: 'Contours', default: 16, minimum: 4, maximum: 32, step: 1, group: 'Style' },
    peaks: { type: 'number', title: 'Peaks', default: 3, minimum: 1, maximum: 5, step: 1, group: 'Style' },
    highlight: { type: 'number', title: 'Accent contour', default: 9, minimum: -1, maximum: 31, step: 1, group: 'Style' },
    indexEvery: { type: 'number', title: 'Index line every', default: 4, minimum: 0, maximum: 8, step: 1, group: 'Style' },
    loopFrames: { type: 'number', title: 'Loop frames', default: 300, minimum: 90, maximum: 900, step: 30, group: 'Motion' },
    seed: { type: 'number', title: 'Seed', default: 2, minimum: 1, maximum: 50, step: 1, group: 'Motion' },
    color: { type: 'string', title: 'Contours', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#E5322D', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const TAU = Math.PI * 2;
    const REACH = 0.95;
    const SOFT = 0.045;
    const RESOLUTION = 90;
    const MIN_RESOLUTION = 20;
    const RIPPLES = 3;
    const seed = Number(p.seed);
    const highlight = Number(p.highlight);
    const indexEvery = Number(p.indexEvery);
    const loopFrames = Math.max(1, Number(p.loopFrames));
    const unit = Math.min(width, height);
    const w = width / unit;
    const h = height / unit;
    const px = unit / 720;

    const r = (k: string) => S.random(`topo-lines-${seed}-${k}`);
    const m = Math.max(1, Math.round(Number(p.peaks)));
    const turn = r('turn') * TAU;
    const peakList = Array.from({ length: m }, (_, k) => {
      const a = turn + (k * TAU) / m + (r(`j${k}`) - 0.5) * 0.8;
      const spread = m === 1 ? 0.06 : 0.24 + r(`d${k}`) * 0.06;
      return {
        x: w / 2 + Math.cos(a) * spread * w,
        y: h / 2 + Math.sin(a) * spread * h * 1.1,
        amp: k === 0 ? 1 : 0.7 + r(`a${k}`) * 0.22,
        phase: r(`p${k}`) * TAU,
        orbit: 0.025 + r(`o${k}`) * 0.025,
        lobes: [r(`l2${k}`) * TAU, r(`l3${k}`) * TAU]
      };
    });
    const ripples = Array.from({ length: RIPPLES }, (_, k) => ({
      fx: (r(`rx${k}`) * 2 - 1) * (3 + k * 2),
      fy: (r(`ry${k}`) * 2 - 1) * (3 + k * 2),
      phase: r(`rp${k}`) * TAU
    }));
    const terrain = (x: number, y: number, tau: number) => {
      let sum = 0;
      for (const pk of peakList) {
        const dx = x - (pk.x + Math.cos(tau + pk.phase) * pk.orbit);
        const dy = y - (pk.y + Math.sin(tau + pk.phase) * pk.orbit);
        const theta = Math.atan2(dy, dx);
        const warp = 1 + 0.14 * Math.sin(2 * theta + pk.lobes[0] + tau) + 0.08 * Math.sin(3 * theta + pk.lobes[1] - tau);
        const amp = pk.amp * (1 + 0.05 * Math.sin(tau + pk.phase));
        sum += Math.exp((amp - (Math.hypot(dx, dy) * warp) / REACH) / SOFT);
      }
      let v = SOFT * Math.log(sum);
      for (const q of ripples) {
        v += 0.03 * Math.sin(q.fx * x + q.fy * y + q.phase + Math.sin(tau + q.phase) * 1.4);
      }
      return v;
    };

    const step = 1 / Math.max(MIN_RESOLUTION, RESOLUTION);
    const nx = Math.ceil(w / step) + 1;
    const ny = Math.ceil(h / step) + 1;
    const grid = new Float32Array(nx * ny);
    const count = Math.max(1, Math.round(Number(p.levels)));
    const thresholds = Array.from({ length: count }, (_, l) => 0.04 + (l * 0.9) / count);
    const s = step * unit;
    const fmt = (n: number) => Math.round(n * 10) / 10;

    const stroke = (paint: string, opacity: number, sw: number) => S.h('path', { stroke: paint, strokeOpacity: opacity, strokeWidth: sw * px });
    const plain = stroke(String(p.color), 0.38, 1.1);
    const index = stroke(String(p.color), 0.85, 1.8);
    const accent = stroke(String(p.accent), 1, 2.6);
    const group = S.h('g', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }, plain, index, accent);
    view.root.replaceChildren(S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${width} ${height}`, style: { display: 'block' } }, group));

    return (frame) => {
      const tau = (TAU * frame) / loopFrames;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          grid[j * nx + i] = terrain(i * step, j * step, tau);
        }
      }

      const out = { plain: '', index: '', accent: '' };
      const X = (i: number) => fmt(i * s);
      const Y = (j: number) => fmt(j * s);

      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = grid[j * nx + i];
          const b = grid[j * nx + i + 1];
          const c = grid[(j + 1) * nx + i + 1];
          const d = grid[(j + 1) * nx + i];
          const lo = Math.min(a, b, c, d);
          const hi = Math.max(a, b, c, d);

          for (let l = 0; l < count; l++) {
            const t = thresholds[l];
            if (t < lo || t >= hi) {
              continue;
            }
            const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
            const top = () => `${X(i + (t - a) / (b - a))} ${Y(j)}`;
            const right = () => `${X(i + 1)} ${Y(j + (t - b) / (c - b))}`;
            const bottom = () => `${X(i + (t - d) / (c - d))} ${Y(j + 1)}`;
            const left = () => `${X(i)} ${Y(j + (t - a) / (d - a))}`;
            let seg = '';
            switch (code) {
              case 1:
              case 14:
                seg = `M ${left()} L ${bottom()} `;
                break;
              case 2:
              case 13:
                seg = `M ${bottom()} L ${right()} `;
                break;
              case 3:
              case 12:
                seg = `M ${left()} L ${right()} `;
                break;
              case 4:
              case 11:
                seg = `M ${top()} L ${right()} `;
                break;
              case 6:
              case 9:
                seg = `M ${top()} L ${bottom()} `;
                break;
              case 7:
              case 8:
                seg = `M ${left()} L ${top()} `;
                break;
              case 5:
                seg = `M ${left()} L ${top()} M ${bottom()} L ${right()} `;
                break;
              case 10:
                seg = `M ${top()} L ${right()} M ${left()} L ${bottom()} `;
                break;
            }

            if (l === highlight) {
              out.accent += seg;
              continue;
            }
            if (indexEvery > 0 && (l + 1) % indexEvery === 0) {
              out.index += seg;
              continue;
            }
            out.plain += seg;
          }
        }
      }

      plain.setAttribute('d', out.plain);
      index.setAttribute('d', out.index);
      accent.setAttribute('d', out.accent);
    };
  }
};
