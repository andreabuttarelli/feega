import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-line-shadow-text',
  title: 'Line shadow text',
  about: 'Bold type with a hatched diagonal shadow that slides slowly behind it.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 450,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Line Shadow', group: 'Content', maxLength: 80 },
    shadowColor: { type: 'string', title: 'Shadow colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 200, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const LOOP_SECONDS = 15;
    const OFFSET = '0.04em';
    const TILE = '0.06em 0.06em';
    const shadow = String(p.shadowColor);
    const common = { fontWeight: 800, fontSize: Number(p.fontSize), fontFamily: S.pick(p.fontFamily, 'Inter'), whiteSpace: 'nowrap' } as const;
    const hatch = S.h('span', { style: { ...common, position: 'absolute', top: OFFSET, left: OFFSET, zIndex: -1, color: 'transparent', backgroundImage: `linear-gradient(45deg, transparent 45%, ${shadow} 45%, ${shadow} 55%, transparent 0)`, backgroundSize: TILE, WebkitBackgroundClip: 'text', backgroundClip: 'text' } }, String(p.text)) as HTMLElement;
    const face = S.h('span', { style: { ...common, color: String(p.textColor) } }, String(p.text));
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', isolation: 'isolate' }, S.h('span', { style: { position: 'relative', zIndex: 0, display: 'inline-flex' } }, face, hatch)));

    return (frame) => {
      const phase = S.cycle(frame, view.fps, LOOP_SECONDS);
      hatch.style.backgroundPosition = `${phase * 100}% ${-phase * 100}%`;
    };
  }
};
