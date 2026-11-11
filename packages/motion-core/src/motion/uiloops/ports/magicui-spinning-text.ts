import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-spinning-text',
  title: 'Spinning text',
  about: 'Letters set on a circle that turns steadily, a badge-style ring of text.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'learn more • earn more • grow more • ', group: 'Content', maxLength: 120 },
    duration: { type: 'number', title: 'Duration (s)', default: 10, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    radius: { type: 'number', title: 'Radius (ch)', default: 5, minimum: 1, maximum: 20, step: 0.5, group: 'Layout' },
    reverse: { type: 'boolean', title: 'Reverse', default: false, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 64, minimum: 12, maximum: 200, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FULL_TURN = 360;
    const letters = [...String(p.text).split(''), ' '];
    const ring = S.h('div', { style: { position: 'relative', fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), fontWeight: 600 } }, ...letters.map((letter, index) => S.h('span', { style: { position: 'absolute', top: '50%', left: '50%', display: 'inline-block', whiteSpace: 'pre', transformOrigin: 'center', transform: `translate(-50%, -50%) rotate(${(FULL_TURN / letters.length) * index}deg) translateY(${-Number(p.radius)}ch)` } }, letter))) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, ring));

    return (frame) => {
      const turn = S.cycle(frame, view.fps, Number(p.duration)) * FULL_TURN;
      ring.style.transform = `rotate(${p.reverse ? -turn : turn}deg)`;
    };
  }
};
