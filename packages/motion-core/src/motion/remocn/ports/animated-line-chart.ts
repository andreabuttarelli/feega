import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'animated-line-chart',
  title: 'Animated line chart',
  about: 'A line draws itself across a grid with a glowing dot riding its leading edge.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#0a0a0a',
  fonts: ['Geist'],
  props: {
    strokeColor: { type: 'string', title: 'Stroke colour', format: PropFormat.Color, default: '#22c55e', group: 'Style' },
    strokeWidth: { type: 'number', title: 'Stroke width', default: 4, minimum: 1, maximum: 16, step: 1, group: 'Style' },
    gridColor: { type: 'string', title: 'Grid colour', format: PropFormat.Color, default: '#27272a', group: 'Style' },
    showDot: { type: 'boolean', title: 'Show leading dot', default: true, group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const stroke = String(p.strokeColor);
    const strokeWidth = Number(p.strokeWidth);
    const grid = String(p.gridColor);
    const showDot = p.showDot !== false;
    const speed = Number(p.speed);
    const face = "Geist, -apple-system, BlinkMacSystemFont, sans-serif";
    const DATA = [12, 19, 8, 15, 22, 18, 28, 25, 32];
    const WIDTH = 1000;
    const HEIGHT = 500;
    const PADDING = 60;
    const GRID_ROWS = 4;
    const DRAW_SHARE = 0.85;
    const innerWidth = WIDTH - PADDING * 2;
    const innerHeight = HEIGHT - PADDING * 2;
    const low = Math.min(...DATA);
    const range = Math.max(...DATA) - low || 1;
    const points = DATA.map((value, index) => ({
      x: PADDING + (index / (DATA.length - 1)) * innerWidth,
      y: PADDING + innerHeight - ((value - low) / range) * innerHeight
    }));
    const lengths = points.slice(1).map((pt, i) => Math.hypot(pt.x - points[i].x, pt.y - points[i].y));
    const pathLength = lengths.reduce((sum, len) => sum + len, 0);
    const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');

    const line = (x1: number, x2: number, y1: number, y2: number, width: number) => S.h('line', { x1, x2, y1, y2, stroke: grid, strokeWidth: width });
    const rows = Array.from({ length: GRID_ROWS + 1 }, (_, i) => line(PADDING, PADDING + innerWidth, PADDING + (i / GRID_ROWS) * innerHeight, PADDING + (i / GRID_ROWS) * innerHeight, 1));
    const cols = Array.from({ length: DATA.length }, (_, i) => line(PADDING + (i / (DATA.length - 1)) * innerWidth, PADDING + (i / (DATA.length - 1)) * innerWidth, PADDING, PADDING + innerHeight, 1));
    const axes = [line(PADDING, PADDING, PADDING, PADDING + innerHeight, 2), line(PADDING, PADDING + innerWidth, PADDING + innerHeight, PADDING + innerHeight, 2)];
    const path = S.h('path', { d, fill: 'none', stroke, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: pathLength, strokeDashoffset: pathLength, style: { filter: `drop-shadow(0 0 12px ${stroke}55)` } }) as SVGElement;
    const dot = S.h('circle', { cx: points[0].x, cy: points[0].y, r: strokeWidth * 2, fill: stroke, style: { filter: `drop-shadow(0 0 8px ${stroke})`, display: 'none' } }) as SVGElement;
    const svg = S.h('svg', { width: WIDTH, height: HEIGHT, viewBox: `0 0 ${WIDTH} ${HEIGHT}`, style: { overflow: 'visible' } }, rows, cols, axes, path, dot);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: face }, svg));

    const dotAt = (target: number) => {
      let travelled = 0;
      for (let i = 0; i < lengths.length; i++) {
        if (travelled + lengths[i] >= target) {
          const t = (target - travelled) / lengths[i];
          return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
        }
        travelled += lengths[i];
      }
      return points[points.length - 1];
    };

    return (at) => {
      const progress = S.spring({ frame: at * speed, fps: view.fps, durationInFrames: Math.round(view.frames * DRAW_SHARE), config: { damping: 200 } });
      path.setAttribute('stroke-dashoffset', String(pathLength * (1 - progress)));
      const visible = showDot && progress > 0 && progress < 1;
      dot.style.display = visible ? '' : 'none';
      if (!visible) {
        return;
      }
      const pos = dotAt(pathLength * progress);
      dot.setAttribute('cx', String(pos.x));
      dot.setAttribute('cy', String(pos.y));
    };
  }
};
