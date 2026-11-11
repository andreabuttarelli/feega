import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-marquee',
  title: 'Marquee',
  about: 'A row of chips scrolls endlessly, horizontally or vertically, in either direction.',
  category: SnapcnCategory.Effect,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    items: { type: 'string', title: 'Items (comma separated)', default: 'Storyboard, Motion, Voice-over, Captions, Brand kit, Export, Templates, Canvas', group: 'Content', maxLength: 400 },
    repeat: { type: 'number', title: 'Repeat', default: 4, minimum: 2, maximum: 8, step: 1, group: 'Layout' },
    duration: { type: 'number', title: 'Duration (s)', default: 40, minimum: 2, maximum: 120, step: 1, group: 'Motion' },
    gap: { type: 'number', title: 'Gap', default: 16, minimum: 0, maximum: 80, step: 1, group: 'Layout' },
    vertical: { type: 'boolean', title: 'Vertical', default: false, group: 'Layout' },
    reverse: { type: 'boolean', title: 'Reverse', default: false, group: 'Motion' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#141414', group: 'Style' },
    chipColor: { type: 'string', title: 'Chip colour', format: PropFormat.Color, default: '#f2f0eb', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const PAD = 8;
    const vertical = Boolean(p.vertical);
    const gap = Number(p.gap);
    const words = String(p.items).split(',').map((w) => w.trim()).filter(Boolean);
    const chip = (word: string) => S.h('div', { style: { flexShrink: 0, padding: '28px 56px', borderRadius: 24, background: String(p.chipColor), color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), fontSize: 44, fontWeight: 600, whiteSpace: 'nowrap' } }, word);
    const copies = Array.from({ length: Math.round(Number(p.repeat)) }, () => S.h('div', { style: { display: 'flex', flexShrink: 0, justifyContent: 'space-around', flexDirection: vertical ? 'column' : 'row', gap } }, ...words.map(chip)) as HTMLElement);

    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, S.h('div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row', gap, padding: PAD, overflow: 'hidden', height: '100%', boxSizing: 'border-box', alignItems: 'center', justifyContent: vertical ? 'center' : 'flex-start' } }, ...copies)));

    return (frame) => {
      const phase = S.cycle(frame, view.fps, Number(p.duration));
      const t = p.reverse ? 1 - phase : phase;
      const axis = vertical ? 'Y' : 'X';
      copies.forEach((el) => {
        el.style.transform = `translate${axis}(calc(${-t * 100}% - ${t * gap}px))`;
      });
    };
  }
};
