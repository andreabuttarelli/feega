import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-orbiting-circles',
  title: 'Orbiting circles',
  about: 'Dots circle a centre point along a thin orbit line, evenly spaced.',
  category: SnapcnCategory.Effect,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 600,
  background: '#ffffff',
  fonts: [],
  props: {
    colors: { type: 'string', title: 'Dot colours (comma separated)', default: '#ff0080, #7928ca, #0070f3, #38bdf8, #f59e0b', group: 'Style', maxLength: 200 },
    duration: { type: 'number', title: 'Duration (s)', default: 20, minimum: 2, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.1, maximum: 8, step: 0.1, group: 'Motion' },
    radius: { type: 'number', title: 'Radius', default: 160, minimum: 20, maximum: 340, step: 1, group: 'Layout' },
    iconSize: { type: 'number', title: 'Dot size', default: 30, minimum: 6, maximum: 120, step: 1, group: 'Layout' },
    path: { type: 'boolean', title: 'Show orbit line', default: true, group: 'Style' },
    reverse: { type: 'boolean', title: 'Reverse', default: false, group: 'Motion' },
    pathColor: { type: 'string', title: 'Orbit line colour (drawn at 10%)', format: PropFormat.Color, default: '#000000', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FULL_TURN = 360;
    const PATH_ALPHA = 0.1;
    const colors = String(p.colors).split(',').map((c) => c.trim()).filter(Boolean);
    const radius = Number(p.radius);
    const size = Number(p.iconSize);
    const seconds = Number(p.duration) / Number(p.speed);
    const orbit = p.path ? S.h('svg', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }, S.h('circle', { cx: '50%', cy: '50%', r: radius, fill: 'none', stroke: S.withAlpha(String(p.pathColor), PATH_ALPHA), strokeWidth: 1 })) : null;
    const dots = colors.map((c) => S.h('div', { style: { position: 'absolute', top: '50%', left: '50%', marginLeft: -size / 2, marginTop: -size / 2, width: size, height: size, borderRadius: 9999, background: c } }) as HTMLElement);
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, orbit, ...dots));

    return (frame) => {
      const turn = S.cycle(frame, view.fps, seconds) * FULL_TURN * (p.reverse ? -1 : 1);
      dots.forEach((dot, index) => {
        const angle = (FULL_TURN / dots.length) * index;
        dot.style.transform = `rotate(${angle + turn}deg) translateY(${radius}px) rotate(${-(angle + turn)}deg)`;
      });
    };
  }
};
