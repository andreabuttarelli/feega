import type { MotionClip } from '../doc';
import type { Box } from '../layout';
import { Align, Direction, Justify, Sizing, TrackType } from '../layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM, type AutoLayout, type LayoutItem, type Padding } from '../layout/model';
import { Horizontal, Vertical, type Constraints } from '../constraints/model';
import type { Rule } from './ir';
import type { TokenBook } from './tokens';

const DIGITS = 100;
const FLUID_FROM = 320;

export const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

export const px = (n: number) => `${round(n)}px`;

const pct = (part: number, whole: number) => `${round((part / whole) * 100)}%`;

type Axis = 'width' | 'height';

const AXES: readonly Axis[] = ['width', 'height'];

const MAIN_AXIS: Record<Direction, Axis | null> = { [Direction.Horizontal]: 'width', [Direction.Vertical]: 'height', [Direction.Grid]: null };

const MIN_KEY: Record<Axis, keyof LayoutItem> = { width: 'minWidth', height: 'minHeight' };
const MAX_KEY: Record<Axis, keyof LayoutItem> = { width: 'maxWidth', height: 'maxHeight' };

const JUSTIFY_CSS: Record<Justify, string | null> = {
  [Justify.Start]: null,
  [Justify.Center]: 'center',
  [Justify.End]: 'flex-end',
  [Justify.SpaceBetween]: 'space-between',
  [Justify.SpaceAround]: 'space-around',
  [Justify.SpaceEvenly]: 'space-evenly'
};

const ALIGN_CSS: Record<Align, string> = { [Align.Start]: 'flex-start', [Align.Center]: 'center', [Align.End]: 'flex-end', [Align.Baseline]: 'baseline' };

const GRID_ALIGN_CSS: Record<Align, string> = { [Align.Start]: 'start', [Align.Center]: 'center', [Align.End]: 'end', [Align.Baseline]: 'baseline' };

export enum Shape {
  Text = 'text',
  Leaf = 'leaf',
  Container = 'container'
}

export type Placed = { clip: MotionClip; shape: Shape; box: Box };

const itemOf = (clip: MotionClip): LayoutItem => clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;

export const isFlowChild = (clip: MotionClip, parent: MotionClip | null): boolean => Boolean(parent?.autoLayout) && !itemOf(clip).absolute;

function fixedRules(axis: Axis, size: number, main: Axis | null, shape: Shape): Rule[] {
  if (axis === main) {
    if (axis === 'height' && shape !== Shape.Leaf) {
      return shape === Shape.Text ? [] : [['min-height', px(size)]];
    }
    return [[axis, px(size)], ['flex-shrink', '0']];
  }
  if (axis === 'width') {
    return size >= FLUID_FROM ? [['width', '100%'], ['max-width', px(size)]] : [['width', px(size)]];
  }
  if (shape === Shape.Text) {
    return [];
  }
  return [[shape === Shape.Leaf ? 'height' : 'min-height', px(size)]];
}

function fillRules(axis: Axis, main: Axis | null): Rule[] {
  if (axis !== main) {
    return [['align-self', 'stretch']];
  }
  return axis === 'width' ? [['flex', '1 1 0'], ['min-width', '0']] : [['flex', '1 1 0']];
}

function gridCell(item: LayoutItem): Rule[] {
  const span = (start: number | undefined, count: number) => (start === undefined ? `span ${count}` : `${start + 1} / span ${count}`);
  const rules: Rule[] = [];
  if (item.column !== undefined || item.columnSpan > 1) {
    rules.push(['grid-column', span(item.column, item.columnSpan)]);
  }
  if (item.row !== undefined || item.rowSpan > 1) {
    rules.push(['grid-row', span(item.row, item.rowSpan)]);
  }
  if (item.cellX) {
    rules.push(['justify-self', GRID_ALIGN_CSS[item.cellX]]);
  }
  if (item.cellY) {
    rules.push(['align-self', GRID_ALIGN_CSS[item.cellY]]);
  }
  return rules;
}

function gridItem(placed: Placed, item: LayoutItem): Rule[] {
  const height: Rule[] = item.height === Sizing.Fixed && placed.shape === Shape.Leaf ? [['height', px(placed.box.height)]] : [];
  return [...gridCell(item), ...height];
}

function limits(item: LayoutItem): Rule[] {
  return AXES.flatMap((axis) => {
    const min = item[MIN_KEY[axis]] as number | undefined;
    const max = item[MAX_KEY[axis]] as number | undefined;
    return [...(min !== undefined ? [[`min-${axis}`, px(min)] as Rule] : []), ...(max !== undefined ? [[`max-${axis}`, px(max)] as Rule] : [])];
  });
}

export function flowItemRules(placed: Placed, flow: AutoLayout): Rule[] {
  const item = itemOf(placed.clip);
  if (flow.direction === Direction.Grid) {
    return [...gridItem(placed, item), ...limits(item)];
  }
  const box = placed.box;
  const main = MAIN_AXIS[flow.direction];
  const sized = AXES.flatMap((axis) => {
    const sizing = item[axis];
    if (sizing === Sizing.Fill) {
      return fillRules(axis, main);
    }
    return sizing === Sizing.Fixed ? fixedRules(axis, box[axis], main, placed.shape) : [];
  });
  const capped = new Set(limits(item).map(([p]) => p));
  return [...sized.filter(([p]) => !capped.has(p)), ...limits(item)];
}

type Edge = (box: Box, parent: Box) => Rule[];

const HORIZONTAL: Record<Horizontal, Edge> = {
  [Horizontal.Left]: (b, p) => [['left', px(b.left - p.left)], ['width', px(b.width)]],
  [Horizontal.Right]: (b, p) => [['right', px(p.left + p.width - b.left - b.width)], ['width', px(b.width)]],
  [Horizontal.LeftRight]: (b, p) => [['left', px(b.left - p.left)], ['right', px(p.left + p.width - b.left - b.width)]],
  [Horizontal.Center]: (b, p) => [['left', `calc(50% - ${px(p.left + p.width / 2 - b.left)})`], ['width', px(b.width)]],
  [Horizontal.Scale]: (b, p) => [['left', pct(b.left - p.left, p.width)], ['width', pct(b.width, p.width)]]
};

const VERTICAL: Record<Vertical, Edge> = {
  [Vertical.Top]: (b, p) => [['top', px(b.top - p.top)], ['height', px(b.height)]],
  [Vertical.Bottom]: (b, p) => [['bottom', px(p.top + p.height - b.top - b.height)], ['height', px(b.height)]],
  [Vertical.TopBottom]: (b, p) => [['top', px(b.top - p.top)], ['bottom', px(p.top + p.height - b.top - b.height)]],
  [Vertical.Center]: (b, p) => [['top', `calc(50% - ${px(p.top + p.height / 2 - b.top)})`], ['height', px(b.height)]],
  [Vertical.Scale]: (b, p) => [['top', pct(b.top - p.top, p.height)], ['height', pct(b.height, p.height)]]
};

const DEFAULT_CONSTRAINTS: Constraints = { horizontal: Horizontal.Left, vertical: Vertical.Top };

export function absoluteRules(placed: Placed, parent: Box): Rule[] {
  const box = placed.box;
  const pinned = placed.clip.constraints ?? DEFAULT_CONSTRAINTS;
  const vertical = VERTICAL[pinned.vertical](box, parent).filter(([p]) => placed.shape !== Shape.Text || p !== 'height');
  return [['position', 'absolute'], ...HORIZONTAL[pinned.horizontal](box, parent), ...vertical];
}

function padding(p: Padding, tokens: TokenBook): Rule[] {
  const sides = [p.top, p.right, p.bottom, p.left];
  if (sides.every((s) => s === 0)) {
    return [];
  }
  const [top, right, bottom, left] = sides.map((s) => (s === 0 ? '0' : tokens.space(s)));
  const all = sides.every((s) => s === p.top);
  const pairs = p.top === p.bottom && p.left === p.right;
  if (all) {
    return [['padding', top]];
  }
  if (pairs) {
    return [['padding-block', top], ['padding-inline', right]];
  }
  return [['padding-top', top], ['padding-right', right], ['padding-bottom', bottom], ['padding-left', left]];
}

function gapRules(flow: AutoLayout, tokens: TokenBook): Rule[] {
  const gap = Math.max(0, flow.gap);
  const cross = Math.max(0, flow.crossGap);
  const spaced = (n: number) => (n === 0 ? '0' : tokens.space(n));
  if (flow.direction === Direction.Grid) {
    return gap === cross ? (gap ? [['gap', spaced(gap)]] : []) : [['row-gap', spaced(cross)], ['column-gap', spaced(gap)]];
  }
  if (!flow.wrap || gap === cross) {
    return gap ? [['gap', spaced(gap)]] : [];
  }
  const [row, column] = flow.direction === Direction.Horizontal ? [cross, gap] : [gap, cross];
  return [['row-gap', spaced(row)], ['column-gap', spaced(column)]];
}

const TRACK_CSS: Record<TrackType, (value: number) => string> = {
  [TrackType.Fixed]: (v) => px(v),
  [TrackType.Flex]: (v) => `minmax(0, ${round(v)}fr)`,
  [TrackType.Hug]: () => 'auto'
};

const tracks = (list: AutoLayout['columnTracks']) => list.map((t) => TRACK_CSS[t.type](t.value)).join(' ');

function gridRules(flow: AutoLayout): Rule[] {
  const columns = flow.columnTracks.length ? tracks(flow.columnTracks) : `repeat(${flow.columns}, minmax(0, 1fr))`;
  const rows: Rule[] = flow.rowTracks.length ? [['grid-template-rows', tracks(flow.rowTracks)]] : [];
  return [['display', 'grid'], ['grid-template-columns', columns], ...rows];
}

function flexRules(flow: AutoLayout): Rule[] {
  const justify = JUSTIFY_CSS[flow.justify];
  return [
    ['display', 'flex'],
    ...(flow.direction === Direction.Vertical ? [['flex-direction', 'column'] as Rule] : []),
    ...(flow.wrap ? [['flex-wrap', 'wrap'] as Rule] : []),
    ...(justify ? [['justify-content', justify] as Rule] : []),
    ['align-items', ALIGN_CSS[flow.align]]
  ];
}

export function containerRules(flow: AutoLayout, tokens: TokenBook): Rule[] {
  const layout = flow.direction === Direction.Grid ? gridRules(flow) : flexRules(flow);
  return [...layout, ...gapRules(flow, tokens), ...padding(flow.padding, tokens)];
}
