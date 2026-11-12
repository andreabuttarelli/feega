import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-border-beam',
  title: 'Border beam',
  about: 'A comet of light travels around the rounded border of a card. A single comet; Shine border is a soft glow.',
  category: SnapcnCategory.Effect,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 180,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    label: { type: 'string', title: 'Card text', default: 'Border Beam', group: 'Content', maxLength: 60 },
    size: { type: 'number', title: 'Beam size', default: 50, minimum: 10, maximum: 300, step: 1, group: 'Layout' },
    duration: { type: 'number', title: 'Duration (s)', default: 6, minimum: 1, maximum: 30, step: 0.5, group: 'Motion' },
    delay: { type: 'number', title: 'Delay (s)', default: 0, minimum: 0, maximum: 30, step: 0.5, group: 'Motion' },
    initialOffset: { type: 'number', title: 'Initial offset (%)', default: 0, minimum: 0, maximum: 100, step: 1, group: 'Motion' },
    borderWidth: { type: 'number', title: 'Border width', default: 1, minimum: 1, maximum: 8, step: 1, group: 'Layout' },
    reverse: { type: 'boolean', title: 'Reverse', default: false, group: 'Motion' },
    colorFrom: { type: 'string', title: 'Colour from', format: PropFormat.Color, default: '#ffaa40', group: 'Style' },
    colorTo: { type: 'string', title: 'Colour to', format: PropFormat.Color, default: '#9c40ff', group: 'Style' },
    cardColor: { type: 'string', title: 'Card colour', format: PropFormat.Color, default: '#141417', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const CARD_W = 640;
    const CARD_H = 360;
    const CARD_RADIUS = 24;
    const size = Number(p.size);
    const r = Math.min(size, CARD_W / 2, CARD_H / 2);
    const top = CARD_W - 2 * r;
    const side = CARD_H - 2 * r;
    const arc = (Math.PI * r) / 2;
    const length = 2 * top + 2 * side + 4 * arc;
    const mask = 'linear-gradient(transparent, transparent), linear-gradient(#000, #000)';

    const pointAt = (distance: number) => {
      let d = ((distance % length) + length) % length;
      const legs: { len: number; at: (u: number) => [number, number, number] }[] = [
        { len: top, at: (u) => [r + u * top, 0, 0] },
        { len: arc, at: (u) => [CARD_W - r + r * Math.sin((u * Math.PI) / 2), r - r * Math.cos((u * Math.PI) / 2), 90 * u] },
        { len: side, at: (u) => [CARD_W, r + u * side, 90] },
        { len: arc, at: (u) => [CARD_W - r + r * Math.cos((u * Math.PI) / 2), CARD_H - r + r * Math.sin((u * Math.PI) / 2), 90 + 90 * u] },
        { len: top, at: (u) => [CARD_W - r - u * top, CARD_H, 180] },
        { len: arc, at: (u) => [r - r * Math.sin((u * Math.PI) / 2), CARD_H - r + r * Math.cos((u * Math.PI) / 2), 180 + 90 * u] },
        { len: side, at: (u) => [0, CARD_H - r - u * side, 270] },
        { len: arc, at: (u) => [r - r * Math.cos((u * Math.PI) / 2), r - r * Math.sin((u * Math.PI) / 2), 270 + 90 * u] }
      ];
      for (const leg of legs) {
        if (d <= leg.len) {
          return leg.at(leg.len ? d / leg.len : 0);
        }
        d -= leg.len;
      }
      return legs[0].at(0);
    };

    const beam = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: size, height: size, background: `linear-gradient(to left, ${String(p.colorFrom)}, ${String(p.colorTo)}, transparent)` } }) as HTMLElement;
    const frame = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 'inherit', border: `${Number(p.borderWidth)}px solid transparent`, WebkitMask: mask, mask, WebkitMaskClip: 'padding-box, border-box', maskClip: 'padding-box, border-box', WebkitMaskComposite: 'xor', maskComposite: 'exclude', overflow: 'hidden' } }, beam);
    const card = S.h('div', { style: { position: 'relative', width: CARD_W, height: CARD_H, borderRadius: CARD_RADIUS, background: String(p.cardColor), border: '1px solid #ffffff1a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: String(p.textColor), fontFamily: S.pick(p.fontFamily, 'Inter'), fontSize: 56, fontWeight: 700 } }, String(p.label), frame);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, card));

    return (f) => {
      const offset = Number(p.initialOffset);
      const run = S.cycle(f, view.fps, Number(p.duration), -Number(p.delay));
      const percent = p.reverse ? 100 - offset - run * 100 : offset + run * 100;
      const [x, y, angle] = pointAt((percent / 100) * length);
      beam.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${angle}deg)`;
    };
  }
};
