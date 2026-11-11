import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-ripple',
  title: 'Ripple',
  about: 'Concentric circles breathe outward from the centre and fade toward the bottom.',
  category: SnapcnCategory.Background,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#ffffff',
  fonts: [],
  props: {
    mainCircleSize: { type: 'number', title: 'Main circle size', default: 210, minimum: 40, maximum: 600, step: 1, group: 'Layout' },
    mainCircleOpacity: { type: 'number', title: 'Main circle opacity', default: 0.24, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    numCircles: { type: 'number', title: 'Circles', default: 8, minimum: 1, maximum: 14, step: 1, group: 'Layout' },
    duration: { type: 'number', title: 'Duration (s)', default: 2, minimum: 0.5, maximum: 8, step: 0.1, group: 'Motion' },
    foreground: { type: 'string', title: 'Ring colour', format: PropFormat.Color, default: '#000000', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const GROWTH = 70;
    const OPACITY_STEP = 0.03;
    const DELAY_STEP = 0.06;
    const SHRINK = 0.9;
    const CSS_EASE = S.Easing.bezier(0.25, 0.1, 0.25, 1);
    const fg = String(p.foreground);
    const count = Math.round(Number(p.numCircles));
    const seconds = Number(p.duration);

    const rings = Array.from({ length: count }, (_, i) => {
      const size = Number(p.mainCircleSize) + i * GROWTH;
      const el = S.h('div', { style: { position: 'absolute', top: '50%', left: '50%', width: size, height: size, borderRadius: 9999, background: S.withAlpha(fg, 0.25), border: `1px solid ${fg}`, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', opacity: Number(p.mainCircleOpacity) - i * OPACITY_STEP, transform: 'translate(-50%, -50%) scale(1)' } }) as HTMLElement;
      return { el, delay: i * DELAY_STEP };
    });

    const mask = 'linear-gradient(to bottom, white, transparent)';
    view.root.replaceChildren(S.fill({ overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }, ...rings.map((r) => r.el)));

    return (frame) => {
      for (const r of rings) {
        const phase = S.cycle(frame, view.fps, seconds, r.delay);
        const scale = S.interpolate(phase, [0, 0.5, 1], [1, SHRINK, 1], { easing: CSS_EASE });
        r.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };
  }
};
