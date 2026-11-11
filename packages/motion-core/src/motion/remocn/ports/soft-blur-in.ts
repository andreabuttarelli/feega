import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'soft-blur-in',
  title: 'Soft blur in',
  about: 'Per-character fade-in with a gentle blur and upward motion, the hero-title reveal.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 60,
  background: '#ffffff',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'Think different.', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    blur: { type: 'number', title: 'Blur (px)', default: 12, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const blur = Number(p.blur);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif');
    const CHAR_FRAMES = 27;
    const TRAVEL_FRAMES = 9;
    const STAGGER = 1;
    const RISE_PX = 16;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.bezier(0.22, 1, 0.36, 1) } as const;

    const chars = Array.from(String(p.text)).map((char) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre', backfaceVisibility: 'hidden', transformOrigin: '50% 55%' } }, char) as HTMLElement);
    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.05em', fontFamily: face } }, chars);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      chars.forEach((el, i) => {
        const local = frame - i * STAGGER;
        el.style.opacity = String(S.interpolate(local, [0, CHAR_FRAMES], [0, 1], clamped));
        el.style.translate = `0 ${S.interpolate(local, [0, TRAVEL_FRAMES], [RISE_PX, 0], clamped)}px`;
        el.style.filter = `blur(${S.interpolate(local, [0, CHAR_FRAMES], [blur, 0], clamped)}px)`;
      });
    };
  }
};
