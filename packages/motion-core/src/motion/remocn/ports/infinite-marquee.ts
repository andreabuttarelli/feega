import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'infinite-marquee',
  title: 'Infinite marquee',
  about: 'Big type scrolls endlessly across the frame in a seamless loop, solid or outlined.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 180,
  background: '#fafafa',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'ship · build · animate · ', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 120, minimum: 12, maximum: 240, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 700, minimum: 400, maximum: 700, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    stroke: { type: 'boolean', title: 'Stroke', default: false, group: 'Style' },
    strokeColor: { type: 'string', title: 'Stroke colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    pixelsPerFrame: { type: 'number', title: 'Pixels / frame', default: 4, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const text = String(p.text);
    const fontSize = Number(p.fontSize);
    const pixelsPerFrame = Number(p.pixelsPerFrame);
    const speed = Number(p.speed);
    const stroke = p.stroke === true || p.stroke === 'true';
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const CHAR_WIDTH_RATIO = 0.55;
    const STROKE_PX = 2;
    const COPIES = 3;
    const loopWidth = Math.max(1, text.length * fontSize * CHAR_WIDTH_RATIO);

    const copies = Array.from({ length: COPIES }, () => S.h('span', { style: { fontSize, fontWeight: Number(p.fontWeight), fontFamily: face, color: stroke ? 'transparent' : String(p.color), WebkitTextStroke: stroke ? `${STROKE_PX}px ${String(p.strokeColor)}` : undefined, paddingRight: '0.4em', letterSpacing: '-0.03em' } }, text));
    const strip = S.h('div', { style: { display: 'flex', whiteSpace: 'nowrap' } }, copies) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, strip));

    return (at) => {
      const frame = at * speed;
      strip.style.translate = `${-((frame * pixelsPerFrame) % loopWidth)}px`;
    };
  }
};
