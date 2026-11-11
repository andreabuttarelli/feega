import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-typing-animation',
  title: 'Typing animation',
  about: 'Text types out character by character behind a blinking cursor, then optionally deletes and loops.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 210,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Typing Animation', group: 'Content', maxLength: 200 },
    typeSpeed: { type: 'number', title: 'Type speed (ms/char)', default: 100, minimum: 10, maximum: 1000, step: 10, group: 'Motion' },
    deleteSpeed: { type: 'number', title: 'Delete speed (ms/char, 0 = half of type speed)', default: 0, minimum: 0, maximum: 1000, step: 10, group: 'Motion' },
    delay: { type: 'number', title: 'Delay (ms)', default: 0, minimum: 0, maximum: 10000, step: 50, group: 'Motion' },
    pauseDelay: { type: 'number', title: 'Pause before delete (ms)', default: 1000, minimum: 0, maximum: 10000, step: 50, group: 'Motion' },
    erase: { type: 'boolean', title: 'Delete and loop', default: false, group: 'Motion' },
    cursorStyle: { type: 'string', title: 'Cursor', enum: ['line', 'block', 'underscore'], default: 'line', group: 'Style' },
    showCursor: { type: 'boolean', title: 'Show cursor', default: true, group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 96, minimum: 20, maximum: 300, step: 1, group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const BLINK = 1.2;
    const CURSOR: Record<string, string> = { line: '|', block: '▌', underscore: '_' };
    const chars = Array.from(String(p.text));
    const type = Number(p.typeSpeed) / 1000;
    const del = (Number(p.deleteSpeed) || Number(p.typeSpeed) / 2) / 1000;
    const start = Number(p.delay) / 1000;
    const pause = Number(p.pauseDelay) / 1000;
    const typed = chars.length * type;
    const deleted = chars.length * del;
    const cycle = typed + pause + deleted + pause;
    const line = S.h('div', { style: { fontWeight: 700, fontSize: Number(p.fontSize), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), whiteSpace: 'pre' } }) as HTMLElement;
    const text = S.h('span') as HTMLElement;
    const caret = S.h('span', { style: { display: 'inline-block' } }, CURSOR[String(p.cursorStyle)] ?? '|') as HTMLElement;
    line.append(text, caret);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (frame) => {
      const t = Math.max(0, frame / view.fps - start);
      const at = p.erase ? t % cycle : t;
      const count = at < typed ? Math.floor(at / type + 1e-9) : p.erase && at >= typed + pause && at < typed + pause + deleted ? chars.length - Math.floor((at - typed - pause) / del + 1e-9) : p.erase && at >= typed + pause + deleted ? 0 : chars.length;
      const done = !p.erase && count >= chars.length;
      text.textContent = chars.slice(0, count).join('');
      caret.style.display = p.showCursor && !done ? 'inline-block' : 'none';
      caret.style.opacity = String(frame / view.fps % BLINK < BLINK / 2 ? 1 : 0);
    };
  }
};
