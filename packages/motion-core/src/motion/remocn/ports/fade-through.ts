import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'fade-through',
  title: 'Fade through',
  about: 'Text exits with a quick fade and lift, then new text fades in with a slight rise, scale and blur.',
  category: SnapcnCategory.Transition,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    fromText: { type: 'string', title: 'From text', default: 'Calm transitions.', group: 'Content', maxLength: 120 },
    toText: { type: 'string', title: 'To text', default: 'Fade through content.', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const EXIT_FRAMES = 8;
    const ENTER_FRAMES = 13;
    const OVERLAP = 1;
    const MICRO_DELAY = 2;
    const enterStart = Math.max(0, EXIT_FRAMES - OVERLAP + MICRO_DELAY);
    const exitEase = S.Easing.bezier(0.4, 0, 1, 1);
    const enterEase = S.Easing.bezier(0.2, 0, 0, 1);
    const exitOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: exitEase } as const;
    const enterOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: enterEase } as const;

    const word = (text: string) =>
      S.h('span', { style: { display: 'inline-block', transformOrigin: '50% 50%', fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face } }, text) as HTMLElement;
    const from = word(String(p.fromText));
    const to = word(String(p.toText));
    const layer = (el: HTMLElement) => S.fill({ alignItems: 'center', justifyContent: 'center' }, el);
    view.root.replaceChildren(layer(from), layer(to));

    return (at) => {
      const frame = at * speed;
      from.style.opacity = String(S.interpolate(frame, [0, EXIT_FRAMES], [1, 0], exitOpts));
      from.style.translate = `0 ${S.interpolate(frame, [0, EXIT_FRAMES], [0, -4], exitOpts)}px`;

      const local = frame - enterStart;
      to.style.opacity = String(S.interpolate(local, [0, ENTER_FRAMES], [0, 1], enterOpts));
      to.style.translate = `0 ${S.interpolate(local, [0, ENTER_FRAMES], [6, 0], enterOpts)}px`;
      to.style.scale = String(S.interpolate(local, [0, ENTER_FRAMES], [0.99, 1], enterOpts));
      to.style.filter = `blur(${S.interpolate(local, [0, ENTER_FRAMES], [2, 0], enterOpts)}px)`;
    };
  }
};
