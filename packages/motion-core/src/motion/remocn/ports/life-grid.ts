import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'life-grid',
  title: 'Life grid',
  about: "Conway's Game of Life on a seeded grid of square tiles, with newborn cells flashing in an accent colour.",
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#111111',
  fonts: [],
  props: {
    cols: { type: 'number', title: 'Columns', default: 48, minimum: 12, maximum: 96, step: 2, group: 'Content' },
    density: { type: 'number', title: 'Density', default: 0.24, minimum: 0.05, maximum: 0.6, step: 0.01, group: 'Content' },
    seed: { type: 'number', title: 'Seed', default: 7, minimum: 1, maximum: 50, step: 1, group: 'Content' },
    gap: { type: 'number', title: 'Gap', default: 0.16, minimum: 0, maximum: 0.4, step: 0.01, group: 'Style' },
    showGrid: { type: 'boolean', title: 'Lattice', default: true, group: 'Style' },
    color: { type: 'string', title: 'Cells', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Newborns', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    framesPerGeneration: { type: 'number', title: 'Frames per generation', default: 5, minimum: 1, maximum: 15, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const gap = Number(p.gap);
    const showGrid = Boolean(p.showGrid);
    const seed = Number(p.seed);
    const density = Number(p.density);
    const speed = Number(p.speed);
    const fpg = Math.max(1, Number(p.framesPerGeneration));
    const nx = Math.max(4, Math.round(Number(p.cols)));
    const ny = Math.max(4, Math.round((nx * H) / W));
    const count = Math.ceil((view.frames * Math.max(0, speed)) / fpg) + 2;
    const grow = S.Easing.out(S.Easing.back(2));
    const shrink = S.Easing.in(S.Easing.cubic);
    const settle = S.Easing.inOut(S.Easing.cubic);
    const fmt = (n: number) => Math.round(n * 10) / 10;

    const first = new Uint8Array(nx * ny);
    for (let i = 0; i < first.length; i++) {
      first[i] = S.random(`life-grid-${seed}-${i}`) < density ? 1 : 0;
    }
    const gens = [first];
    while (gens.length < count) {
      const prev = gens[gens.length - 1];
      const next = new Uint8Array(nx * ny);
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) {
                continue;
              }
              n += prev[((y + dy + ny) % ny) * nx + ((x + dx + nx) % nx)];
            }
          }
          const alive = prev[y * nx + x] === 1;
          next[y * nx + x] = n === 3 || (alive && n === 2) ? 1 : 0;
        }
      }
      gens.push(next);
    }

    const cell = Math.min(W / nx, H / ny);
    const ox = (W - cell * nx) / 2;
    const oy = (H - cell * ny) / 2;
    const tile = cell * (1 - gap);
    const square = (index: number, size: number) => {
      const x = ox + (index % nx) * cell + (cell - size) / 2;
      const y = oy + Math.floor(index / nx) * cell + (cell - size) / 2;
      const s = fmt(size);
      return `M ${fmt(x)} ${fmt(y)} h ${s} v ${s} h ${-s} Z `;
    };

    const latticePath = S.h('path', { fill: String(p.color), fillOpacity: 0.05 });
    const freshPath = S.h('path', { fill: String(p.accent) });
    const alivePath = S.h('path', { fill: String(p.color) });
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } }, showGrid ? latticePath : null, freshPath, alivePath);
    view.root.replaceChildren(S.fill({}, svg));

    return (at) => {
      const time = Math.max(0, at * speed);
      const g = Math.min(gens.length - 1, Math.floor(time / fpg));
      const local = Math.min(1, (time - g * fpg) / fpg);
      const now = gens[g];
      const before = g > 0 ? gens[g - 1] : now;
      const bornSize = tile * (0.35 + 0.65 * grow(local));
      const dyingSize = tile * (1 - shrink(Math.min(1, local * 1.6)));
      const coreSize = tile * settle(Math.min(1, Math.max(0, (local - 0.35) / 0.65)));
      let lattice = '';
      let alive = '';
      let fresh = '';
      for (let i = 0; i < now.length; i++) {
        if (showGrid) {
          lattice += square(i, tile);
        }
        if (now[i]) {
          if (!before[i] && g > 0) {
            fresh += square(i, bornSize);
            if (coreSize > 0.5) {
              alive += square(i, coreSize);
            }
          } else {
            alive += square(i, tile);
          }
        } else if (before[i] && dyingSize > 0.5) {
          alive += square(i, dyingSize);
        }
      }
      latticePath.setAttribute('d', lattice);
      freshPath.setAttribute('d', fresh);
      alivePath.setAttribute('d', alive);
    };
  }
};
