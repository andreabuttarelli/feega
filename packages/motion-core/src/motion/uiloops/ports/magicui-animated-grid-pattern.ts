import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-animated-grid-pattern',
  title: 'Animated grid pattern',
  about: 'A fine grid where random cells fade in and out, hopping to a new spot each time. Few cells at a time; Flickering grid flickers all.',
  category: SnapcnCategory.Background,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#ffffff',
  fonts: [],
  props: {
    width: { type: 'number', title: 'Cell width', default: 40, minimum: 8, maximum: 200, step: 1, group: 'Layout' },
    height: { type: 'number', title: 'Cell height', default: 40, minimum: 8, maximum: 200, step: 1, group: 'Layout' },
    numSquares: { type: 'number', title: 'Squares', default: 50, minimum: 1, maximum: 200, step: 1, group: 'Layout' },
    maxOpacity: { type: 'number', title: 'Max opacity', default: 0.5, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    duration: { type: 'number', title: 'Duration (s)', default: 4, minimum: 0.2, maximum: 20, step: 0.1, group: 'Motion' },
    repeatDelay: { type: 'number', title: 'Repeat delay (s)', default: 0.5, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    color: { type: 'string', title: 'Line and cell colour (drawn at 30%)', format: PropFormat.Color, default: '#9ca3af', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const STAGGER = 0.1;
    const EASE_IN_OUT = S.Easing.bezier(0.42, 0, 0.58, 1);
    const w = Number(p.width);
    const h = Number(p.height);
    const duration = Number(p.duration);
    const hold = Number(p.repeatDelay);
    const GRID_ALPHA = 0.3;
    const color = S.withAlpha(String(p.color), GRID_ALPHA);
    const count = Math.round(Number(p.numSquares));
    const lines = S.h('svg', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }, S.h('defs', null, S.h('pattern', { id: 'grid', width: w, height: h, patternUnits: 'userSpaceOnUse', x: -1, y: -1 }, S.h('path', { d: `M.5 ${h}V.5H${w}`, fill: 'none', stroke: color }))), S.h('rect', { width: '100%', height: '100%', fill: 'url(#grid)' }));
    const cells = Array.from({ length: count }, () => S.h('rect', { width: w - 1, height: h - 1, fill: color, strokeWidth: 0, opacity: 0 }) as SVGElement);
    const layer = S.h('svg', { x: -1, y: -1, style: { overflow: 'visible' } }, ...cells);
    lines.append(layer);
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, lines));

    return (frame) => {
      const t = frame / view.fps;
      cells.forEach((cell, i) => {
        const delay = i * STAGGER;
        const period = delay + duration * 2 + hold;
        const round = Math.floor(t / period);
        const into = t - round * period - delay;
        const pick = (axis: string, span: number, unit: number) => Math.floor((S.random(`magicui-grid-${i}-${round}-${axis}`) * span) / unit) * unit + 1;
        cell.setAttribute('x', String(pick('x', view.width, w)));
        cell.setAttribute('y', String(pick('y', view.height, h)));
        const up = S.clamp(into / duration, 0, 1);
        const down = S.clamp((into - duration - hold) / duration, 0, 1);
        const level = into < duration + hold ? EASE_IN_OUT(up) : 1 - EASE_IN_OUT(down);
        cell.setAttribute('opacity', String(into < 0 ? 0 : level * Number(p.maxOpacity)));
      });
    };
  }
};
