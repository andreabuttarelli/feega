import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-shine-border',
  title: 'Shine border',
  about: 'A soft gradient glow slides around the border of a card.',
  category: SnapcnCategory.Effect,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 420,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    label: { type: 'string', title: 'Card text', default: 'Shine Border', group: 'Content', maxLength: 60 },
    shineColor: { type: 'string', title: 'Shine colours (comma separated)', default: '#A07CFE, #FE8FB5, #FFBE7B', group: 'Style', maxLength: 200 },
    borderWidth: { type: 'number', title: 'Border width', default: 1, minimum: 1, maximum: 12, step: 1, group: 'Layout' },
    duration: { type: 'number', title: 'Duration (s)', default: 14, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    cardColor: { type: 'string', title: 'Card colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#141414', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const mask = 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)';
    const border = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 'inherit', padding: Number(p.borderWidth), backgroundImage: `radial-gradient(transparent, transparent, ${String(p.shineColor)}, transparent, transparent)`, backgroundSize: '300% 300%', WebkitMask: mask, mask, WebkitMaskComposite: 'xor', maskComposite: 'exclude' } }) as HTMLElement;
    const card = S.h('div', { style: { position: 'relative', width: 640, height: 360, borderRadius: 24, background: String(p.cardColor), border: '1px solid #0000001a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), fontSize: 56, fontWeight: 700 } }, String(p.label), border);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, card));

    return (frame) => {
      const phase = S.cycle(frame, view.fps, Number(p.duration));
      const at = (phase < 0.5 ? phase : 1 - phase) * 2 * 100;
      border.style.backgroundPosition = `${at}% ${at}%`;
    };
  }
};
