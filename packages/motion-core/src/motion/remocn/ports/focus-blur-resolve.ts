import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'focus-blur-resolve',
  title: 'Focus blur resolve',
  about: 'Text pulls into focus from a blur, holds, then blurs out and lifts away.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Focus resolves clearly.', group: 'Content', maxLength: 120 },
    blur: { type: 'number', title: 'Blur (px)', default: 14, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const blur = Number(p.blur);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const ENTER = 23;
    const EXIT = 16;
    const total = view.frames;
    const exitStart = Math.max(ENTER, total - EXIT);
    const enterEase = S.Easing.bezier(0.22, 1, 0.36, 1);
    const exitEase = S.Easing.bezier(0.64, 0, 0.78, 0);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face, display: 'inline-block', transformOrigin: '50% 50%' } }, String(p.text));
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      const enter = (to: number, from: number) => S.interpolate(frame, [0, ENTER], [from, to], { ...clamped, easing: enterEase });
      const exit = (to: number) => S.interpolate(frame, [exitStart, total], [0, to], { ...clamped, easing: exitEase });
      line.style.opacity = String(enter(1, 0) * (1 - exit(1)));
      line.style.translate = `0 ${enter(0, 14) + exit(-10)}px`;
      line.style.scale = String(enter(1, 1.01));
      line.style.filter = `blur(${enter(0, blur) + exit(10)}px)`;
    };
  }
};
