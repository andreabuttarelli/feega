import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'isometric-build',
  title: 'Isometric build',
  about: 'An isometric grid of blocks springs up diagonal by diagonal into a stepped city, with one accent tower rising above the rest.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#111111',
  fonts: [],
  props: {
    grid: { type: 'number', title: 'Tiles per side', default: 5, minimum: 2, maximum: 9, step: 1, group: 'Content' },
    maxHeight: { type: 'number', title: 'Max height', default: 2.2, minimum: 0.5, maximum: 4, step: 0.1, group: 'Content' },
    seed: { type: 'number', title: 'Seed', default: 4, minimum: 1, maximum: 50, step: 1, group: 'Content' },
    gap: { type: 'number', title: 'Gap', default: 0.04, minimum: 0, maximum: 0.3, step: 0.01, group: 'Style' },
    floors: { type: 'boolean', title: 'Floor lines', default: true, group: 'Style' },
    color: { type: 'string', title: 'Blocks', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Accent tower', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    stagger: { type: 'number', title: 'Stagger', default: 2, minimum: 0, maximum: 6, step: 0.5, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const ISO_Y = Math.tan(Math.PI / 6);
    const ISO_Z = 1 / Math.cos(Math.PI / 6);
    const FLOOR = 0.42;
    const SHADE_LEFT = 0.32;
    const SHADE_RIGHT = 0.6;
    const SPRING = { damping: 11, stiffness: 140, mass: 0.7 };
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const fmt = (v: number) => Math.round(v * 10) / 10;
    const n = Math.max(1, Math.round(Number(p.grid)));
    const maxHeight = Number(p.maxHeight);
    const stagger = Number(p.stagger);
    const seed = Number(p.seed);
    const speed = Number(p.speed);
    const floors = Boolean(p.floors);
    const color = String(p.color);
    const accent = String(p.accent);
    const background = String(p.background);
    const inset = Math.min(0.45, Math.max(0, Number(p.gap))) / 2;
    const unit = Math.min(W, H) / 720;
    const r = (key: string) => S.random(`isometric-build-${seed}-${key}`);

    const inner = Math.max(1, n - 2);
    const ai = n > 2 ? 1 + Math.floor(r('ai') * inner) : 0;
    const aj = n > 2 ? 1 + Math.floor(r('aj') * inner) : 0;
    const blocks: { i: number; j: number; height: number; accent: boolean; delay: number }[] = [];
    for (let sum = 0; sum <= 2 * (n - 1); sum++) {
      for (let i = 0; i < n; i++) {
        const j = sum - i;
        if (j < 0 || j >= n) {
          continue;
        }
        const isAccent = i === ai && j === aj;
        const c = (n - 1) / 2;
        const centre = 1 - Math.hypot(i - c, j - c) / (Math.hypot(c, c) || 1);
        const raw = maxHeight * (0.2 + 0.8 * centre ** 1.3) * (0.75 + 0.5 * r(`h${i}-${j}`));
        const snapped = Math.max(FLOOR, Math.round(raw / FLOOR) * FLOOR);
        blocks.push({ i, j, accent: isAccent, height: isAccent ? maxHeight * 1.35 : snapped, delay: (2 * (n - 1) - sum) * stagger + r(`d${i}-${j}`) * stagger });
      }
    }

    const tallest = maxHeight * 1.35;
    const a = Math.min((W * 0.64) / (2 * n), (H * 0.8) / (2 * n * ISO_Y + tallest * ISO_Z));
    const b = a * ISO_Y;
    const hz = a * ISO_Z;
    const top = (H - (2 * n * b + tallest * hz)) / 2 + tallest * hz;
    const cx = W / 2;
    const P = (u: number, v: number, z: number) => `${fmt(cx + (u - v) * a)} ${fmt(top + (u + v) * b - z * hz)}`;
    const poly = (...pts: string[]) => `M ${pts.join(' L ')} Z`;

    let ground = '';
    for (let k = 0; k <= n; k++) {
      ground += `M ${P(k, 0, 0)} L ${P(k, n, 0)} M ${P(0, k, 0)} L ${P(n, k, 0)} `;
    }
    const groundPath = S.h('path', { d: ground, fill: 'none', stroke: color, strokeOpacity: 0.12, strokeWidth: unit });

    const cells = blocks.map((block) => {
      const fill = block.accent ? accent : color;
      const leftA = S.h('path', { fill });
      const leftB = S.h('path', { fill: background, fillOpacity: SHADE_LEFT });
      const rightA = S.h('path', { fill });
      const rightB = S.h('path', { fill: background, fillOpacity: SHADE_RIGHT });
      const lines = S.h('path', { fill: 'none', stroke: background, strokeOpacity: 0.35, strokeWidth: unit * 1.2 });
      const roof = S.h('path', { fill, stroke: background, strokeOpacity: 0.5, strokeWidth: unit, strokeLinejoin: 'round' });
      const g = S.h('g', null, leftA, leftB, rightA, rightB, lines, roof);
      return { block, g, leftA, leftB, rightA, rightB, lines, roof };
    });
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } }, groundPath, cells.map((cell) => cell.g));
    view.root.replaceChildren(S.fill({}, svg));

    return (at) => {
      const time = at * speed;
      cells.forEach(({ block, g, leftA, leftB, rightA, rightB, lines, roof }) => {
        const s = S.spring({ frame: time - block.delay, fps: view.fps, config: SPRING });
        const opacity = S.interpolate(s, [0, 0.15], [0, 1], clamped);
        g.setAttribute('opacity', String(opacity));
        if (opacity <= 0) {
          return;
        }
        const h = Math.max(0.02, block.height * s);
        const u0 = block.i + inset;
        const u1 = block.i + 1 - inset;
        const v0 = block.j + inset;
        const v1 = block.j + 1 - inset;
        const left = poly(P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, h), P(u0, v1, h));
        const right = poly(P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, h), P(u1, v0, h));
        leftA.setAttribute('d', left);
        leftB.setAttribute('d', left);
        rightA.setAttribute('d', right);
        rightB.setAttribute('d', right);
        roof.setAttribute('d', poly(P(u0, v0, h), P(u1, v0, h), P(u1, v1, h), P(u0, v1, h)));
        let floorLines = '';
        if (floors) {
          for (let z = FLOOR; z < h - FLOOR * 0.5; z += FLOOR) {
            floorLines += `M ${P(u0, v1, z)} L ${P(u1, v1, z)} L ${P(u1, v0, z)} `;
          }
        }
        lines.setAttribute('d', floorLines);
      });
    };
  }
};
