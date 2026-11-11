import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'slot-machine-roll',
  title: 'Slot machine roll',
  about: 'Each character column rolls like a slot reel from the old value to the new one.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    from: { type: 'string', title: 'From', default: '$99', group: 'Content', maxLength: 24 },
    to: { type: 'string', title: 'To', default: '$199', group: 'Content', maxLength: 24 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 120, minimum: 12, maximum: 240, step: 1, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    fontWeight: { type: 'string', title: 'Font weight', enum: ['400', '500', '600', '700'], default: '700', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const speed = Number(p.speed);
    const fontSize = Number(p.fontSize);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const LINE = 1.1;
    const COLUMN_DELAY = 4;
    const SPRING = { damping: 14 };
    const len = Math.max(String(p.from).length, String(p.to).length);
    const from = String(p.from).padStart(len, ' ');
    const to = String(p.to).padStart(len, ' ');

    const reels = Array.from({ length: len }, (_, i) => S.h('span', { style: { display: 'flex', flexDirection: 'column', whiteSpace: 'pre' } }, [S.h('span', {}, from[i]), S.h('span', {}, to[i])]) as HTMLElement);
    const columns = reels.map((reel) => S.h('span', { style: { display: 'inline-block', overflow: 'hidden', height: `${LINE}em`, lineHeight: `${LINE}em`, verticalAlign: 'top', width: '0.7em', textAlign: 'center' } }, reel));
    const line = S.h('span', { style: { fontSize, fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face, lineHeight: LINE } }, columns);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      reels.forEach((reel, i) => {
        const t = Math.max(0, Math.min(1, S.spring({ frame: frame - i * COLUMN_DELAY, fps: view.fps, config: SPRING })));
        reel.style.translate = `0 ${-t * fontSize * LINE}px`;
      });
    };
  }
};
