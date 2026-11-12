import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-animated-shiny-text',
  title: 'Shiny text',
  about: 'A band of light sweeps across the text, pauses, then sweeps back. A light band, not a colour gradient.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Made with feega', group: 'Content', maxLength: 120 },
    shimmerWidth: { type: 'number', title: 'Shimmer width', default: 100, minimum: 20, maximum: 600, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#525252', group: 'Style' },
    shineColor: { type: 'string', title: 'Shine colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 96, minimum: 20, maximum: 300, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const LOOP_SECONDS = 8;
    const TEXT_ALPHA = 0.7;
    const SHINE_ALPHA = 0.8;
    const CSS_EASE = S.Easing.bezier(0.25, 0.1, 0.25, 1);
    const width = Number(p.shimmerWidth);
    const label = S.h('span', { style: { fontWeight: 500, fontSize: Number(p.fontSize), fontFamily: S.pick(p.fontFamily, 'Inter'), color: S.withAlpha(String(p.textColor), TEXT_ALPHA), backgroundImage: `linear-gradient(to right, transparent, ${S.withAlpha(String(p.shineColor), SHINE_ALPHA)} 50%, transparent)`, backgroundSize: `${width}px 100%`, backgroundRepeat: 'no-repeat', WebkitBackgroundClip: 'text', backgroundClip: 'text' } }, String(p.text)) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, label));

    return (frame) => {
      const k = S.interpolate(S.cycle(frame, view.fps, LOOP_SECONDS), [0, 0.3, 0.6, 0.9, 1], [-1, 1, 1, -1, -1], { easing: CSS_EASE });
      label.style.backgroundPosition = `calc(${k * 100}% + ${k * width}px) 0`;
    };
  }
};
