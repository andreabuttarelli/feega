import type { Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { BORDER, CardPart, Fit, LEADING, UiGlyph, at, box, glyph, image, measure, panel, write, type Ctx } from './card-kit';
import { rect, solid } from './shapes';

const BADGE = { inset: 8, padX: 6, padY: 2, size: 10.5, fill: '#000000', alpha: 0.6 };
const ACTION = { inset: 8, padX: 8, padY: 3, size: 11, gap: 4 };
const PROMPT = { size: 11.5, gap: 6, icon: 22 };

const lift = (size: number) => (size * LEADING - size) / 2 - 1;

function actions(x: Ctx): Item[] {
  const { c, theme } = x;
  let right = c.w - ACTION.inset;
  return [...c.face.actions].reverse().flatMap((label) => {
    const w = measure(x, label, ACTION.size) + ACTION.padX * 2 + BORDER * 2;
    const b = { x: right - w, y: ACTION.inset, w, h: ACTION.padY * 2 + ACTION.size * LEADING + BORDER * 2 };
    right = b.x - ACTION.gap;
    return [...box(x, CardPart.Button, b, theme.paper, theme.line), ...write(x, CardPart.Button, label, ACTION.size, theme.ink, b.x + BORDER + ACTION.padX, b.y + BORDER + ACTION.padY + lift(ACTION.size), null)];
  });
}

export function effectsItems(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const mark = icons ? (f.kind === 'effects' ? icons.ui[UiGlyph.Image] : f.kind && icons.badge.get(f.kind)) : null;
  if (!f.media) {
    const top = (c.h - PROMPT.icon - PROMPT.gap - PROMPT.size * LEADING) / 2;
    return [
      ...panel(x),
      ...(mark ? glyph(x, CardPart.Media, mark, (c.w - PROMPT.icon) / 2, top, theme.inkSoft) : []),
      ...actions(x),
      ...write(x, CardPart.Empty, f.empty, PROMPT.size, theme.inkSoft, (c.w - measure(x, f.empty, PROMPT.size)) / 2, top + PROMPT.icon + PROMPT.gap, null)
    ];
  }
  const tag = f.subtitle ? measure(x, f.subtitle, BADGE.size) + BADGE.padX * 2 : 0;
  const tagH = BADGE.padY * 2 + BADGE.size * LEADING;
  return [
    ...panel(x),
    image(x, CardPart.Media, f.media, { x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: c.h - 2 * BORDER }, Fit.Contain),
    ...(f.subtitle ? [solid(x.clip(CardPart.Badge), at(c, [rect(BADGE.inset, c.h - BADGE.inset - tagH, tag, tagH)]), BADGE.fill, BADGE.alpha), ...write(x, CardPart.Badge, f.subtitle, BADGE.size, '#ffffff', BADGE.inset + BADGE.padX, c.h - BADGE.inset - tagH + BADGE.padY + lift(BADGE.size), null)] : []),
    ...actions(x)
  ];
}
