import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'rolodex-flip',
  title: 'Rolodex flip',
  about: 'A word flips away like a rolodex card while the next one folds in from below, cycling through a list.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 110,
  background: '#141318',
  fonts: ['Geist'],
  props: {
    items: { type: 'string', title: 'Words (comma separated)', default: 'Design, Motion, Launch, feega', group: 'Content', maxLength: 200 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 96, minimum: 12, maximum: 220, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    interval: { type: 'number', title: 'Interval', default: 20, minimum: 10, maximum: 40, step: 2, group: 'Motion' },
    flipDuration: { type: 'number', title: 'Flip duration', default: 10, minimum: 4, maximum: 20, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const interval = Number(p.interval);
    const flipDuration = Number(p.flipDuration);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const FLIP_DEGREES = 85;
    const LIFT_PX = 20;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeIn = { ...clamped, easing: S.Easing.in(S.Easing.cubic) };
    const easeOut = { ...clamped, easing: S.Easing.out(S.Easing.cubic) };

    const items = String(p.items).split(',').map((item) => item.trim()).filter(Boolean);
    const sizer = items.reduce((a, b) => (b.length > a.length ? b : a), '');
    const cards = items.map((item) => S.h('span', { style: { position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', transformOrigin: '50% 50%', backfaceVisibility: 'hidden' } }, item) as HTMLElement);
    const holder = S.h('span', { style: { position: 'relative', display: 'inline-block', perspective: '420px', verticalAlign: 'bottom', fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face } }, S.h('span', { style: { visibility: 'hidden' } }, sizer), cards);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, holder));

    return (frame) => {
      cards.forEach((card, i) => {
        let rotate = 0;
        let y = 0;
        let opacity = 1;

        if (i > 0) {
          const start = (i - 1) * interval + flipDuration / 2;
          const pIn = S.interpolate(frame, [start, start + flipDuration], [0, 1], easeOut);
          rotate = (1 - pIn) * -FLIP_DEGREES;
          y = (1 - pIn) * LIFT_PX;
          opacity = pIn;
        }

        if (i < items.length - 1) {
          const start = i * interval;
          const pOut = S.interpolate(frame, [start, start + flipDuration], [0, 1], easeIn);
          rotate += pOut * FLIP_DEGREES;
          y -= pOut * LIFT_PX;
          opacity *= 1 - pOut;
        }

        card.style.display = opacity <= 0.001 ? 'none' : 'block';
        card.style.opacity = String(opacity);
        card.style.transform = `translateY(${y}px) rotateX(${rotate}deg)`;
      });
    };
  }
};
