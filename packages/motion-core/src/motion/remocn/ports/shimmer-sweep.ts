import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'shimmer-sweep',
  title: 'Shimmer sweep',
  about: 'A band of light sweeps across the text, the loading shimmer used for AI status labels.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Generating', group: 'Content', maxLength: 120 },
    baseColor: { type: 'string', title: 'Base colour', format: PropFormat.Color, default: '#3f3f46', group: 'Style' },
    shineColor: { type: 'string', title: 'Shine colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 96, minimum: 12, maximum: 200, step: 1, group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '700', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const SWEEP_SHARE = 0.8;
    const START_POS = 200;
    const END_POS = -100;
    const font = { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), letterSpacing: '-0.03em', fontFamily: face, margin: 0, lineHeight: 1 };
    const shine = `linear-gradient(110deg, transparent 30%, ${String(p.shineColor)} 50%, transparent 70%)`;

    const base = S.h('span', { style: { ...font, color: String(p.baseColor) } }, String(p.text));
    const glow = S.h('span', { style: { ...font, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', backgroundClip: 'text', webkitBackgroundClip: 'text', backgroundImage: shine, backgroundSize: '200% 100%' } }, String(p.text)) as HTMLElement;
    const box = S.h('div', { style: { position: 'relative', display: 'inline-block' } }, [base, glow]);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, box));

    return (at) => {
      const frame = at * speed;
      const pos = S.interpolate(frame, [0, view.frames * SWEEP_SHARE], [START_POS, END_POS], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      glow.style.backgroundPosition = `${pos}% 50%`;
    };
  }
};
