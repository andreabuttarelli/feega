import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'per-character-rise',
  title: 'Per-character rise',
  about: 'Each character rises into place with a fade, staggered one frame apart.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 60,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'One more thing.', group: 'Content', maxLength: 120 },
    distance: { type: 'number', title: 'Distance (px)', default: 32, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const distance = Number(p.distance);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const FADE_FRAMES = 21;
    const TRAVEL_FRAMES = 10;
    const STAGGER = 1;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const fadeEase = S.Easing.bezier(0.2, 0.8, 0.2, 1);
    const travelEase = S.Easing.bezier(0.2, 0.8, 0.6, 0.85);

    const chars = Array.from(String(p.text)).map((char) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre', backfaceVisibility: 'hidden', transformOrigin: '50% 55%' } }, char) as HTMLElement);
    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.05em', fontFamily: face } }, chars);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      chars.forEach((el, i) => {
        const local = frame - i * STAGGER;
        el.style.opacity = String(S.interpolate(local, [0, FADE_FRAMES], [0, 1], { ...clamped, easing: fadeEase }));
        el.style.translate = `0 ${S.interpolate(local, [0, TRAVEL_FRAMES], [distance, 0], { ...clamped, easing: travelEase })}px`;
      });
    };
  }
};
