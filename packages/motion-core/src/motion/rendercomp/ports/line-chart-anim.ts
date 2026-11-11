import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'line-chart-anim',
  title: 'Line chart',
  about: 'A title fades in, then a line draws left to right across a grid while dots and month labels pop in as it reaches them.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0b1220',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Monthly Active Users', group: 'Content', maxLength: 80 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Last six months (thousands)', group: 'Content', maxLength: 120 },
    points: { type: 'string', title: 'Points (label;value | ...)', default: 'Jan;40 | Feb;55 | Mar;50 | Apr;72 | May;88 | Jun;95', group: 'Content', maxLength: 600 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0b1220', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    lineColor: { type: 'string', title: 'Line colour', format: PropFormat.Color, default: '#22d3ee', group: 'Style' },
    gridColor: { type: 'string', title: 'Grid colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const lineColor = String(p.lineColor);
    const background = String(p.background);
    const WIDTH = 1000;
    const HEIGHT = 460;
    const PAD_X = 60;
    const PAD_Y = 40;
    const DRAW_START = 20;
    const DRAW_END = 110;
    const GRID_LINES = 4;
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_Y * 2;

    const points = String(p.points)
      .split('|')
      .map((row) => row.split(';').map((cell) => cell.trim()))
      .filter((cells) => cells[0] || cells[1])
      .map((cells) => ({ label: cells[0], value: Number(cells[1]) || 0 }));
    const maxV = Math.max(...points.map((pt) => pt.value), 1);
    const steps = Math.max(points.length - 1, 1);

    const coords = points.map((pt, i) => ({
      x: PAD_X + (innerW * i) / steps,
      y: PAD_Y + innerH - (pt.value / maxV) * innerH,
      label: pt.label,
      appear: DRAW_START + ((DRAW_END - DRAW_START) * i) / steps
    }));
    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const pathLen = coords.slice(1).reduce((sum, c, i) => sum + Math.hypot(c.x - coords[i].x, c.y - coords[i].y), 0);

    const grid = Array.from({ length: GRID_LINES }, (_, i) => {
      const y = PAD_Y + (innerH * i) / (GRID_LINES - 1);
      return S.h('line', { x1: PAD_X, y1: y, x2: PAD_X + innerW, y2: y, stroke: S.withAlpha(String(p.gridColor), 0.08), strokeWidth: 1 });
    });
    const path = S.h('path', { d: pathD, fill: 'none', stroke: lineColor, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: pathLen, strokeDashoffset: pathLen }) as SVGElement;
    const dots = coords.map((c) => S.h('circle', { cx: c.x, cy: c.y, r: 0, fill: lineColor, stroke: background, strokeWidth: 3 }) as SVGElement);
    const labels = coords.map((c) => S.h('text', { x: c.x, y: PAD_Y + innerH + 28, textAnchor: 'middle', fill: 'rgba(255,255,255,0.7)', fontSize: 18, fontFamily: face, opacity: 0 }, c.label) as SVGElement);

    const subtitle = String(p.subtitle);
    const head = S.h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 } },
      S.h('div', { style: { fontSize: 60, fontWeight: 900, color: String(p.titleColor), letterSpacing: 2 } }, String(p.title)),
      subtitle ? S.h('div', { style: { fontSize: 28, fontWeight: 600, color: lineColor } }, subtitle) : null
    ) as HTMLElement;

    view.root.replaceChildren(
      S.fill(
        { backgroundColor: background, alignItems: 'center', justifyContent: 'center', padding: 80, gap: 40, fontFamily: face },
        head,
        S.h('svg', { width: WIDTH, height: HEIGHT + 40, viewBox: `0 0 ${WIDTH} ${HEIGHT + 40}` }, grid, path, dots, labels)
      )
    );

    const DOT_EASE = S.Easing.out(S.Easing.back(1.5));

    return (frame) => {
      head.style.opacity = String(S.interpolate(frame, [0, 14], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) }));

      const progress = S.interpolate(frame, [DRAW_START, DRAW_END], [0, 1], { ...clamped, easing: S.Easing.inOut(S.Easing.cubic) });
      path.setAttribute('stroke-dashoffset', String(pathLen * (1 - progress)));

      coords.forEach((c, i) => {
        const scale = S.interpolate(frame, [c.appear - 2, c.appear + 6], [0, 1], { ...clamped, easing: DOT_EASE });
        dots[i].setAttribute('r', String(10 * scale));
        labels[i].setAttribute('opacity', String(S.interpolate(frame, [c.appear, c.appear + 8], [0, 1], clamped)));
      });
    };
  }
};
