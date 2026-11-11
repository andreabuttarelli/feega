import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'animated-bar-chart',
  title: 'Animated bar chart',
  about: 'Bars spring up from the baseline one after another, with a soft glow under each.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#0a0a0a',
  fonts: ['Geist'],
  props: {
    barColor: { type: 'string', title: 'Bar colour', format: PropFormat.Color, default: '#0ea5e9', group: 'Style' },
    gap: { type: 'number', title: 'Gap', default: 16, minimum: 0, maximum: 80, step: 2, group: 'Style' },
    staggerFrames: { type: 'number', title: 'Stagger frames', default: 6, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const barColor = String(p.barColor);
    const gap = Number(p.gap);
    const stagger = Number(p.staggerFrames);
    const speed = Number(p.speed);
    const face = "Geist, -apple-system, BlinkMacSystemFont, sans-serif";
    const DATA = [35, 60, 45, 80, 55, 70, 90, 65];
    const WIDTH = 1000;
    const HEIGHT = 500;
    const PADDING = 60;
    const innerWidth = WIDTH - PADDING * 2;
    const innerHeight = HEIGHT - PADDING * 2;
    const peak = Math.max(...DATA);
    const barWidth = (innerWidth - gap * (DATA.length - 1)) / DATA.length;
    const baseY = PADDING + innerHeight;
    const SPRING = { damping: 12, stiffness: 100, mass: 0.8 };

    const bars = DATA.map((value, index) => {
      const barHeight = (value / peak) * innerHeight;
      return S.h('rect', {
        x: PADDING + index * (barWidth + gap),
        y: baseY - barHeight,
        width: barWidth,
        height: barHeight,
        rx: 6,
        fill: barColor,
        style: { transformBox: 'fill-box', transformOrigin: '50% 100%', filter: `drop-shadow(0 4px 16px ${barColor}55)` }
      }) as SVGElement;
    });
    const baseline = S.h('line', { x1: PADDING, x2: PADDING + innerWidth, y1: baseY, y2: baseY, stroke: '#27272a', strokeWidth: 2 });
    const svg = S.h('svg', { width: WIDTH, height: HEIGHT, viewBox: `0 0 ${WIDTH} ${HEIGHT}` }, baseline, bars);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: face }, svg));

    return (at) => {
      const frame = at * speed;
      bars.forEach((bar, index) => {
        const grown = S.spring({ frame: frame - index * stagger, fps: view.fps, config: SPRING });
        bar.style.scale = `1 ${grown}`;
      });
    };
  }
};
