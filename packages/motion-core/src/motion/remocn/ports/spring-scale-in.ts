import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'spring-scale-in',
  title: 'Spring scale in',
  about: 'Words pop in one after another, scaling up with an overshooting spring curve.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 60,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Fast. Crisp. Fluid.', group: 'Content', maxLength: 120 },
    staggerDelay: { type: 'number', title: 'Stagger (frames)', default: 3, minimum: 1, maximum: 12, step: 1, group: 'Motion' },
    scaleFrom: { type: 'number', title: 'Scale from', default: 0.7, minimum: 0.1, maximum: 1, step: 0.05, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '600', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const stagger = Number(p.staggerDelay);
    const scaleFrom = Number(p.scaleFrom);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const WORD_FRAMES = 11;
    const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.bezier(0.34, 1.56, 0.64, 1) } as const;

    const words = String(p.text).split(' ').map((word) => S.h('span', { style: { display: 'inline-block', marginRight: '0.25em', transformOrigin: '50% 50%' } }, word) as HTMLElement);
    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face } }, words);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      words.forEach((el, i) => {
        const local = frame - i * stagger;
        el.style.opacity = String(S.interpolate(local, [0, WORD_FRAMES], [0, 1], opts));
        el.style.scale = String(S.interpolate(local, [0, WORD_FRAMES], [scaleFrom, 1], opts));
      });
    };
  }
};
