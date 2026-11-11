import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-aurora-text',
  title: 'Aurora text',
  about: 'A shifting aurora gradient drifts, tilts and breathes inside the letters.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Aurora', group: 'Content', maxLength: 120 },
    colors: { type: 'string', title: 'Colours (comma separated)', default: '#FF0080, #7928CA, #0070F3, #38bdf8', group: 'Style', maxLength: 200 },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.2, maximum: 4, step: 0.1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 200, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const BASE_SECONDS = 10;
    const EASE_IN_OUT = S.Easing.bezier(0.42, 0, 0.58, 1);
    const STOPS = [0, 0.25, 0.5, 0.75, 1];
    const colors = String(p.colors).split(',').map((c) => c.trim()).filter(Boolean);
    const seconds = BASE_SECONDS / Number(p.speed);
    const label = S.h('span', { style: { display: 'inline-block', fontWeight: 700, fontSize: Number(p.fontSize), fontFamily: S.pick(p.fontFamily, 'Inter'), backgroundImage: `linear-gradient(135deg, ${colors.join(', ')}, ${colors[0]})`, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' } }, String(p.text)) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, label));

    const along = (t: number, values: number[]) => S.interpolate(t, STOPS, values, { easing: EASE_IN_OUT });

    return (frame) => {
      const run = frame / view.fps / seconds;
      const whole = Math.floor(run);
      const t = whole % 2 ? 1 - (run - whole) : run - whole;
      label.style.backgroundPosition = `${along(t, [0, 50, 100, 50, 0])}% ${along(t, [50, 100, 50, 0, 50])}%`;
      label.style.transform = `rotate(${along(t, [-5, 5, -3, 3, -5])}deg) scale(${along(t, [0.9, 1.1, 0.95, 1.05, 0.9])})`;
    };
  }
};
