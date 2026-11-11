import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'dolly-zoom',
  title: 'Dolly zoom',
  about: 'A vertigo shot down a corridor: the figure holds its size while the walls stretch behind it.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 66,
  background: '#0B0B0B',
  fonts: [],
  props: {
    intensity: { type: 'number', title: 'Intensity', default: 1, minimum: 0, maximum: 2, step: 0.1, group: 'Motion' },
    reverse: { type: 'boolean', title: 'Reverse', default: false, group: 'Motion' },
    doorColor: { type: 'string', title: 'Door', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    figureColor: { type: 'string', title: 'Figure', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    lineColor: { type: 'string', title: 'Lines', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const speed = Number(p.speed);
    const intensity = Number(p.intensity);
    const reverse = p.reverse === true || p.reverse === 'true';
    const C = { wall: '#1B1B1B', wallAlt: '#151515', floor: '#262626', floorAlt: '#1D1D1D', light: '#FFFFFF' };
    const door = String(p.doorColor);
    const line = String(p.lineColor);
    const START = 4;
    const END = 36;
    const HALF_W = 2;
    const CEIL = -1.3;
    const FLOOR = 1.7;
    const SUBJECT_Z = 6;
    const DOOR_Z = 14;
    const NEAR = 0.25;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const k = height * 0.19;
    const cx = width / 2;
    const cy = height / 2;
    const figureH = k * 1.75;
    const doorW = 0.85;
    const doorTop = FLOOR - 2.3;

    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }) as SVGElement;
    const vignette = S.fill({ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' });
    const figure = S.h('svg', { viewBox: '0 0 60 175', height: figureH, style: { position: 'absolute' } },
      S.h('g', { fill: String(p.figureColor) },
        S.h('circle', { cx: 30, cy: 14, r: 12 }),
        S.h('path', { d: 'M12 34 Q30 26 48 34 L54 96 Q54 102 48 102 L44 102 L42 172 L33 172 L30 108 L27 172 L18 172 L16 102 L12 102 Q6 102 6 96 Z' }))) as SVGElement;
    view.root.style.overflow = 'hidden';
    view.root.replaceChildren(svg, vignette, figure);

    return (at) => {
      const t = (at * speed * 30) / view.fps;
      const move = S.interpolate(t, [START, END], [0, 1], { ...clamp, easing: S.Easing.bezier(0.45, 0, 0.3, 1) });
      const amount = reverse ? 1 - move : move;
      const d0 = SUBJECT_Z;
      const d1 = d0 / (1 + 1.7 * Math.max(0, intensity));
      const dist = d0 + (d1 - d0) * amount;
      const cam = SUBJECT_Z - dist;
      const f = k * dist;

      const project = ([x, y, z]: number[]) => {
        const depth = Math.max(NEAR, z - cam);
        return [cx + (f * x) / depth, cy + (f * y) / depth];
      };
      const poly = (list: number[][]) => list.map(project).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const fog = (z: number) => S.interpolate(z - cam, [1, DOOR_Z - cam], [1, 0.25], clamp);
      const quad = (points: number[][], fill: string, opacity?: number) => S.h('polygon', { points: poly(points), fill, opacity });

      const segments: Element[] = [];
      const L = -HALF_W;
      const R = HALF_W;
      for (let z = DOOR_Z - 1; z >= Math.floor(cam); z--) {
        const z0 = Math.max(z, cam + NEAR);
        const z1 = z + 1;
        if (z1 <= z0) {
          continue;
        }
        const alt = z % 2 === 0;
        const parts = [
          quad([[L, FLOOR, z0], [R, FLOOR, z0], [R, FLOOR, z1], [L, FLOOR, z1]], alt ? C.floor : C.floorAlt),
          quad([[L, CEIL, z0], [R, CEIL, z0], [R, CEIL, z1], [L, CEIL, z1]], C.wallAlt),
          quad([[L, CEIL, z0], [L, FLOOR, z0], [L, FLOOR, z1], [L, CEIL, z1]], alt ? C.wall : C.wallAlt),
          quad([[R, CEIL, z0], [R, FLOOR, z0], [R, FLOOR, z1], [R, CEIL, z1]], alt ? C.wall : C.wallAlt),
          quad([[-0.35, CEIL, z + 0.3], [0.35, CEIL, z + 0.3], [0.35, CEIL, z + 0.7], [-0.35, CEIL, z + 0.7]], C.light, 0.75 * fog(z))
        ];
        if (z >= cam + NEAR) {
          parts.push(S.h('polygon', { points: poly([[L, CEIL, z], [R, CEIL, z], [R, FLOOR, z], [L, FLOOR, z]]), fill: 'none', stroke: line, strokeOpacity: 0.32 * fog(z), strokeWidth: Math.max(1, (f / (z - cam)) * 0.012) }));
        }
        segments.push(S.h('g', null, ...parts));
      }

      const edges = [[L, CEIL], [R, CEIL], [L, FLOOR], [R, FLOOR]].map(([x, y]) => {
        const a = project([x, y, Math.max(-4, cam + NEAR)]);
        const b = project([x, y, Math.max(DOOR_Z, cam + NEAR)]);
        return S.h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: line, strokeOpacity: 0.45, strokeWidth: 1.5 });
      });

      svg.replaceChildren(
        quad([[L, CEIL, DOOR_Z], [R, CEIL, DOOR_Z], [R, FLOOR, DOOR_Z], [L, FLOOR, DOOR_Z]], C.wallAlt),
        quad([[-doorW, doorTop, DOOR_Z], [doorW, doorTop, DOOR_Z], [doorW, FLOOR, DOOR_Z], [-doorW, FLOOR, DOOR_Z]], door),
        ...segments,
        ...edges
      );

      const floorY = project([0, FLOOR, SUBJECT_Z])[1];
      figure.style.left = `${cx - (figureH * 60) / 175 / 2}px`;
      figure.style.top = `${floorY - figureH}px`;
    };
  }
};
