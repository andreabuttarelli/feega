import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-hyper-text',
  title: 'Hyper text',
  about: 'Letters scramble through random capitals and lock into place one by one, over and over. Repeats; Scramble text decodes once.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 180,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Hyper Text', group: 'Content', maxLength: 80 },
    duration: { type: 'number', title: 'Scramble duration (ms)', default: 800, minimum: 100, maximum: 5000, step: 50, group: 'Motion' },
    repeatEvery: { type: 'number', title: 'Repeat every (s)', default: 3, minimum: 1, maximum: 20, step: 0.5, group: 'Motion' },
    delay: { type: 'number', title: 'Delay (ms)', default: 0, minimum: 0, maximum: 5000, step: 50, group: 'Motion' },
    characters: { type: 'string', title: 'Scramble characters', default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', group: 'Content', maxLength: 80 },
    fontSize: { type: 'number', title: 'Font size', default: 144, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const letters = String(p.text).split('');
    const set = String(p.characters).split('');
    const seconds = Number(p.duration) / 1000;
    const spans = letters.map((l) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', width: l === ' ' ? '0.75rem' : undefined } }, l) as HTMLElement);
    const line = S.h('div', { style: { fontWeight: 700, fontSize: Number(p.fontSize), color: String(p.textColor), display: 'flex' } }, ...spans);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (frame) => {
      const t = frame / view.fps - Number(p.delay) / 1000;
      const into = t < 0 ? 0 : t % Number(p.repeatEvery);
      const progress = Math.min(into / seconds, 1);
      const locked = progress * letters.length;
      spans.forEach((span, i) => {
        const settled = t < 0 || progress >= 1 || letters[i] === ' ' || i <= locked;
        span.textContent = settled ? letters[i] : (set[Math.floor(S.random(`magicui-hyper-${frame}-${i}`) * set.length)] ?? letters[i]);
      });
    };
  }
};
