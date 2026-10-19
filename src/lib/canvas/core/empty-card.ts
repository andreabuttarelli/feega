import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { FillRule } from '$lib/motion/gpu-full/paint';
import { dashes } from '$lib/motion/gpu-full/stroke';
import type { Box } from '$lib/canvas/gpu/geometry';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { line, rect, solid } from './shapes';

export enum EmptyPart {
  Paper = 'empty-paper',
  Border = 'empty-border',
  IconBox = 'empty-icon-box',
  Icon = 'empty-icon',
  Title = 'empty-title',
  Hint = 'empty-hint'
}

export type EmptyFace = { title: string; hint: string; icon: number[][] | null };

type Kit = { theme: CoreTheme; glyphs: Glyphs; bold: Glyphs };

const TRACK = -0.8;
const BORDER = 1;
const DASH = 3;
const ICON_BOX = 40;
const ICON = 20;
const GAP = 6;
const TITLE = { size: 13, leading: 1.5, above: 4 };
const HINT = { size: 12, leading: 1.4, width: 230 };

export function emptyItems(c: Box & { id: string }, f: EmptyFace, kit: Kit): PathItem[] {
  const { theme } = kit;
  const clip = (p: EmptyPart, n = 0) => (n ? `${c.id}:${p}:${n}` : `${c.id}:${p}`);
  const at = (contours: number[][], dx = 0, dy = 0) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + c.x + dx : v + c.y + dy)));
  const scissor: [number, number, number, number] = [c.x, c.y, c.x + c.w, c.y + c.h];

  const title = kit.bold(f.title, TITLE.size, { leading: TITLE.leading, tracking: TRACK });
  const hint = kit.glyphs(f.hint, HINT.size, { leading: HINT.leading, tracking: TRACK, width: HINT.width });
  const total = ICON_BOX + GAP + TITLE.above + TITLE.size * TITLE.leading + GAP + hint.height;
  const top = (c.h - total) / 2;
  const cx = c.w / 2;
  const box = { x: cx - ICON_BOX / 2, y: top, w: ICON_BOX, h: ICON_BOX };
  const titleTop = top + ICON_BOX + GAP + TITLE.above;
  const hintTop = titleTop + TITLE.size * TITLE.leading + GAP;
  const outline = rect(BORDER / 2, BORDER / 2, c.w - BORDER, c.h - BORDER);

  return [
    solid(clip(EmptyPart.Paper), at([rect(0, 0, c.w, c.h)]), theme.paper),
    ...dashes(outline, true, DASH, DASH).map((d, i) => solid(clip(EmptyPart.Border, i + 1), at(line(d, BORDER)), theme.line2)),
    solid(clip(EmptyPart.IconBox), at([rect(box.x, box.y, box.w, box.h)]), theme.paper2),
    solid(clip(EmptyPart.IconBox, 1), at(line(rect(box.x + BORDER / 2, box.y + BORDER / 2, box.w - BORDER, box.h - BORDER), BORDER, true)), theme.line),
    ...(f.icon ? [{ ...solid(clip(EmptyPart.Icon), at(f.icon, cx - ICON / 2, top + (ICON_BOX - ICON) / 2), theme.inkSoft), rule: FillRule.Union }] : []),
    { ...solid(clip(EmptyPart.Title), at(title.contours, cx - title.width / 2, titleTop), theme.ink), scissor },
    { ...solid(clip(EmptyPart.Hint), at(hint.contours, cx - hint.width / 2, hintTop), theme.inkSoft), scissor }
  ];
}
