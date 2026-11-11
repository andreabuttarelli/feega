import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'tracking-in',
  title: 'Tracking in',
  about: 'Wide letter-spacing and blur spring shut into a tight, sharp headline.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'tracking in', group: 'Content', maxLength: 120 },
    startTracking: { type: 'number', title: 'Start tracking (em)', default: 0.5, minimum: 0, maximum: 2, step: 0.05, group: 'Motion' },
    startBlur: { type: 'number', title: 'Start blur (px)', default: 12, minimum: 0, maximum: 40, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 96, minimum: 12, maximum: 200, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '700', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const startTracking = Number(p.startTracking);
    const startBlur = Number(p.startBlur);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const END_TRACKING = -0.03;
    const FADE_FRAMES = 15;
    const SPRING = { damping: 18, stiffness: 90 };

    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), fontFamily: face, whiteSpace: 'nowrap' } }, String(p.text));
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      const t = S.spring({ frame, fps: view.fps, config: SPRING });
      line.style.letterSpacing = `${S.interpolate(t, [0, 1], [startTracking, END_TRACKING])}em`;
      line.style.filter = `blur(${S.interpolate(t, [0, 1], [startBlur, 0])}px)`;
      line.style.opacity = String(S.interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    };
  }
};
