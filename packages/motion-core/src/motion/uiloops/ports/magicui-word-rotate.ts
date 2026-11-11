import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-word-rotate',
  title: 'Word rotate',
  about: 'A headline swaps through a list of words, each sliding out downward and the next dropping in.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 225,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    words: { type: 'string', title: 'Words (comma separated)', default: 'Word, Rotate, Motion, Canvas', group: 'Content', maxLength: 300 },
    duration: { type: 'number', title: 'Time per word (ms)', default: 2500, minimum: 500, maximum: 10000, step: 50, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size', default: 160, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const SLIDE = 50;
    const HALF = 0.25;
    const EASE_OUT = S.Easing.bezier(0, 0, 0.58, 1);
    const words = String(p.words).split(',').map((w) => w.trim()).filter(Boolean);
    const interval = Number(p.duration) / 1000;
    const heading = S.h('h1', { style: { margin: 0, fontWeight: 700, fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), whiteSpace: 'nowrap' } }) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, heading));

    return (frame) => {
      const t = frame / view.fps;
      const ticks = Math.floor(t / interval);
      const since = t - ticks * interval;
      const exiting = ticks > 0 && since < HALF;
      const shown = exiting ? ticks - 1 : ticks;
      const into = exiting ? since / HALF : (since - (ticks > 0 ? HALF : 0)) / HALF;
      const k = EASE_OUT(S.clamp(into, 0, 1));
      heading.textContent = words[shown % words.length] ?? '';
      heading.style.opacity = String(exiting ? 1 - k : ticks > 0 ? k : 1);
      heading.style.transform = `translateY(${exiting ? SLIDE * k : ticks > 0 ? -SLIDE * (1 - k) : 0}px)`;
    };
  }
};
