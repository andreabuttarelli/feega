import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-meteors',
  title: 'Meteors',
  about: 'Shooting stars streak diagonally across the scene on endless loops.',
  category: SnapcnCategory.Background,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#0a0a0b',
  fonts: [],
  props: {
    number: { type: 'number', title: 'Meteors', default: 20, minimum: 1, maximum: 80, step: 1, group: 'Layout' },
    minDelay: { type: 'number', title: 'Min delay (s)', default: 0.2, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    maxDelay: { type: 'number', title: 'Max delay (s)', default: 1.2, minimum: 0, maximum: 10, step: 0.1, group: 'Motion' },
    minDuration: { type: 'number', title: 'Min duration (s)', default: 2, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    maxDuration: { type: 'number', title: 'Max duration (s)', default: 10, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    angle: { type: 'number', title: 'Angle', default: 215, minimum: 0, maximum: 360, step: 1, group: 'Layout' },
    scale: { type: 'number', title: 'Size (1 = original, larger for video)', default: 3, minimum: 1, maximum: 8, step: 0.5, group: 'Layout' },
    color: { type: 'string', title: 'Meteor colour', format: PropFormat.Color, default: '#71717a', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    let drawn = 0;
    const next = () => S.random(`magicui-meteors-${drawn++}`);
    const scale = Number(p.scale);
    const TRAVEL = 500 * scale;
    const FADE_AT = 0.7;
    const TAIL = 50 * scale;
    const count = Math.round(Number(p.number));
    const lo = Number(p.minDelay);
    const hi = Number(p.maxDelay);
    const durLo = Number(p.minDuration);
    const durHi = Number(p.maxDuration);
    const ROTATED_TWICE = 2;
    const angle = -Number(p.angle) * ROTATED_TWICE;
    const color = String(p.color);

    const meteors = Array.from({ length: count }, () => {
      const left = Math.floor(next() * view.width);
      const delay = next() * (hi - lo) + lo;
      const duration = Math.floor(next() * (durHi - durLo) + durLo);
      const head = S.h('span', { style: { position: 'absolute', top: '-5%', left, width: 2 * scale, height: 2 * scale, borderRadius: 9999, background: color, boxShadow: '0 0 0 1px #ffffff10' } }, S.h('div', { style: { position: 'absolute', top: '50%', width: TAIL, height: 1, transform: 'translateY(-50%)', background: `linear-gradient(to right, ${color}, transparent)` } })) as HTMLElement;
      return { head, delay, duration };
    });

    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, ...meteors.map((m) => m.head)));

    return (frame) => {
      for (const m of meteors) {
        const phase = S.cycle(frame, view.fps, m.duration, m.delay);
        m.head.style.transform = `rotate(${angle}deg) translateX(${-TRAVEL * phase}px)`;
        m.head.style.opacity = String(S.interpolate(phase, [0, FADE_AT, 1], [1, 1, 0]));
      }
    };
  }
};
