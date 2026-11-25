import type { Area, BarSize, Point } from './anchors';

export enum Edge {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left'
}

export type Docked = { edge: Edge; offset: number };
export type Box = { x: number; y: number; w: number; h: number };

export const TAB_LENGTH_PX = 64;
export const TAB_THICKNESS_PX = 18;
const OUTSIDE_SHARE = 0.6;

type Placement = {
  outside: (box: Box, area: Area) => number;
  along: (at: Point, area: Area) => number;
  span: (area: Area) => number;
  tab: (offset: number, area: Area) => Box;
  slide: string;
  chevron: number;
};

const PLACEMENTS: Record<Edge, Placement> = {
  [Edge.Top]: {
    outside: (b, a) => (a.y - b.y) / b.h,
    along: (at, a) => at.x - a.x,
    span: (a) => a.w,
    tab: (o, a) => ({ x: a.x + o, y: a.y, w: TAB_LENGTH_PX, h: TAB_THICKNESS_PX }),
    slide: 'translateY(-160%)',
    chevron: 180
  },
  [Edge.Right]: {
    outside: (b, a) => (b.x + b.w - (a.x + a.w)) / b.w,
    along: (at, a) => at.y - a.y,
    span: (a) => a.h,
    tab: (o, a) => ({ x: a.x + a.w - TAB_THICKNESS_PX, y: a.y + o, w: TAB_THICKNESS_PX, h: TAB_LENGTH_PX }),
    slide: 'translateX(160%)',
    chevron: 270
  },
  [Edge.Bottom]: {
    outside: (b, a) => (b.y + b.h - (a.y + a.h)) / b.h,
    along: (at, a) => at.x - a.x,
    span: (a) => a.w,
    tab: (o, a) => ({ x: a.x + o, y: a.y + a.h - TAB_THICKNESS_PX, w: TAB_LENGTH_PX, h: TAB_THICKNESS_PX }),
    slide: 'translateY(160%)',
    chevron: 0
  },
  [Edge.Left]: {
    outside: (b, a) => (a.x - b.x) / b.w,
    along: (at, a) => at.y - a.y,
    span: (a) => a.h,
    tab: (o, a) => ({ x: a.x, y: a.y + o, w: TAB_THICKNESS_PX, h: TAB_LENGTH_PX }),
    slide: 'translateX(-160%)',
    chevron: 90
  }
};

const EDGES = Object.values(Edge);

export function dockedEdge(at: Point, area: Area, bar: BarSize): Docked | null {
  const box = { ...at, ...bar };
  const share = (edge: Edge) => PLACEMENTS[edge].outside(box, area);
  const edge = EDGES.reduce((best, next) => (share(next) > share(best) ? next : best));
  if (share(edge) <= OUTSIDE_SHARE) {
    return null;
  }

  const { along, span } = PLACEMENTS[edge];
  const offset = Math.round(Math.min(Math.max(along(at, area), 0), span(area) - TAB_LENGTH_PX));
  return { edge, offset };
}

export const tabBox = (docked: Docked, area: Area): Box => PLACEMENTS[docked.edge].tab(docked.offset, area);

export const slideAway = (edge: Edge) => PLACEMENTS[edge].slide;

export const chevronTurn = (edge: Edge) => PLACEMENTS[edge].chevron;

export const isDocked = (value: unknown): value is Docked => {
  const v = value as Docked | null;
  return !!v && EDGES.includes(v.edge) && typeof v.offset === 'number';
};
