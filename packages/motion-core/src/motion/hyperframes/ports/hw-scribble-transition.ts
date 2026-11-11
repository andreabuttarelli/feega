import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'hw-scribble-transition',
  title: 'Scribble transition',
  about: 'Fat zigzag marker bands scribble across and cover the frame, a solid backstop holds the cover, then the bands scribble off.',
  category: HfCategory.Transition,
  origin: HfOrigin.Block,
  source: 'hw-scribble-transition',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 66,
  background: '#0f1115',
  fonts: [],
  props: {
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#ffb020', group: 'Style' },
    bands: { type: 'number', title: 'Bands', default: 7, minimum: 2, maximum: 14, step: 1, group: 'Layout' },
    strokeScale: { type: 'number', title: 'Stroke scale', default: 1, minimum: 0.5, maximum: 1.5, step: 0.05, group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 17, minimum: 1, maximum: 999, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const bands = Math.round(Math.min(14, Math.max(2, Number(p.bands) || 7)));
    const scale = Number(p.strokeScale) || 1;
    const seed = Number(p.seed) || 17;
    const color = String(p.color);
    const hash = (n: number) => {
      const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
      return (x - Math.floor(x)) * 2 - 1;
    };
    const bandH = H / bands;
    const zigs = 7;

    const drawn = Array.from({ length: bands }, (_, b) => {
      const y0 = b * bandH + bandH / 2;
      const points = [[-80, y0 + hash(b * 17) * 20]];
      for (let i = 1; i <= zigs; i++) {
        points.push([(W + 160) * (i / zigs) - 80, y0 + (i % 2 ? -1 : 1) * bandH * 0.32 + hash(b * 17 + i) * 16]);
      }
      const length = points.slice(1).reduce((sum, pt, i) => sum + Math.hypot(pt[0] - points[i][0], pt[1] - points[i][1]), 0);
      const d = points.map((pt, i) => `${i ? 'L' : 'M'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
      const path = S.h('path', { d, fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: Math.ceil(bandH * 0.85 * scale), strokeDasharray: length }) as SVGElement;
      return { path, length };
    });

    const svg = S.h('svg', { viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }, ...drawn.map((d) => d.path));
    const solid = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: color } }) as HTMLElement;
    const stage = S.fill({ overflow: 'hidden' }, svg, solid) as HTMLElement;
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    tl.set(solid, { opacity: 0 }, 0);
    drawn.forEach(({ path, length }, i) => {
      tl.set(path, { strokeDashoffset: i % 2 ? -length : length }, 0);
      tl.to(path, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.in' }, 0.04 * i);
    });
    tl.to(solid, { opacity: 1, duration: 0.12, ease: 'none' }, 0.8);
    tl.to(solid, { opacity: 0, duration: 0.15, ease: 'none' }, 1.42);
    drawn.forEach(({ path, length }, i) => {
      tl.to(path, { strokeDashoffset: i % 2 ? length : -length, duration: 0.5, ease: 'power2.out' }, 1.42 + 0.035 * i);
    });
    tl.set(stage, { visibility: 'hidden' }, 2.17);

    return (frame) => tl.render(frame / view.fps);
  }
};
