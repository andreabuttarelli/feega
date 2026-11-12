import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-animated-gradient-text',
  title: 'Animated gradient text',
  about: 'A two-colour gradient flows endlessly through the letters of a headline. Colour flows in the letters; Shiny text sweeps a light band.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Introducing Motion', group: 'Content', maxLength: 120 },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.2, maximum: 4, step: 0.1, group: 'Motion' },
    colorFrom: { type: 'string', title: 'Colour from', format: PropFormat.Color, default: '#ffaa40', group: 'Style' },
    colorTo: { type: 'string', title: 'Colour to', format: PropFormat.Color, default: '#9c40ff', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 120, minimum: 20, maximum: 300, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const LOOP_SECONDS = 8;
    const BASE_SIZE = 300;
    const size = Number(p.speed) * BASE_SIZE;
    const from = String(p.colorFrom);
    const to = String(p.colorTo);
    const label = S.h('span', { style: { display: 'inline', fontWeight: 700, fontSize: Number(p.fontSize), fontFamily: S.pick(p.fontFamily, 'Inter'), backgroundImage: `linear-gradient(to right, ${from}, ${to}, ${from})`, backgroundSize: `${size}% 100%`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } }, String(p.text)) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, label));

    return (frame) => {
      label.style.backgroundPosition = `${S.cycle(frame, view.fps, LOOP_SECONDS) * size}% 0`;
    };
  }
};
