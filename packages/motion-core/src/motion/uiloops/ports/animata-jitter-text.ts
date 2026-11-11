import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'animata-jitter-text',
  title: 'Jitter text',
  about: 'Text trembles through a short burst of tiny shifts and tilts, rests, then trembles back.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Jitter', group: 'Content', maxLength: 60 },
    duration: { type: 'number', title: 'Burst duration (s)', default: 0.6, minimum: 0.1, maximum: 5, step: 0.1, group: 'Motion' },
    repeatDelay: { type: 'number', title: 'Rest between bursts (s)', default: 0.5, minimum: 0, maximum: 5, step: 0.1, group: 'Motion' },
    scale: { type: 'number', title: 'Shift scale (1 = original pixels)', default: 4, minimum: 0.5, maximum: 12, step: 0.5, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 200, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const EASE_IN_OUT = S.Easing.bezier(0.42, 0, 0.58, 1);
    const Y = [1.5, 1, -1, 1.5, -1.5, 1, -0.5, 0];
    const X = [0, -1, 1.5, -1.5, 1, -1, 0.5, 0];
    const R = [0.5, -1.5, 1, -1.5, 1, -1, 1, 0];
    const stops = Y.map((_, i) => i / (Y.length - 1));
    const burst = Number(p.duration);
    const rest = Number(p.repeatDelay);
    const label = S.h('span', { style: { display: 'inline-block', fontWeight: 700, fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter') } }, String(p.text)) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, label));

    return (frame) => {
      const t = frame / view.fps;
      const lap = burst + rest;
      const round = Math.floor(t / lap);
      const into = Math.min((t - round * lap) / burst, 1);
      const phase = round % 2 ? 1 - into : into;
      const at = (values: number[]) => Math.round(S.interpolate(phase, stops, values, { easing: EASE_IN_OUT }) * 1000) / 1000;
      const k = Number(p.scale);
      label.style.transform = `translate(${at(X) * k}px, ${at(Y) * k}px) rotate(${at(R) * k}deg)`;
    };
  }
};
