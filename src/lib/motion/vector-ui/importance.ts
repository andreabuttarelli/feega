import { VectorRole, type VectorNode, type VectorUi } from './model';

export enum Zone {
  Main = 'main',
  Nav = 'nav'
}

const LEFT_STRIP = 0.18;
const RIGHT_STRIP = 0.06;
const TOP_BAND = 0.06;
const NAV_PENALTY = 4;

const ROLE_WEIGHT: Record<VectorRole, number> = {
  [VectorRole.Input]: 6,
  [VectorRole.Button]: 5,
  [VectorRole.Stat]: 4,
  [VectorRole.Image]: 4,
  [VectorRole.Card]: 4,
  [VectorRole.Heading]: 3,
  [VectorRole.Text]: 1,
  [VectorRole.Link]: 1,
  [VectorRole.Icon]: 0,
  [VectorRole.Box]: 0
};

export function zoneOf(ui: VectorUi, n: VectorNode): Zone {
  const cx = (n.x + n.w / 2) / ui.width;
  const cy = (n.y + n.h / 2) / ui.height;
  return cx < LEFT_STRIP || cx > 1 - RIGHT_STRIP || cy < TOP_BAND ? Zone.Nav : Zone.Main;
}

export type Ranked = { id: string; role: VectorRole; zone: Zone; score: number; text?: string };

export function ranked(ui: VectorUi): Ranked[] {
  return ui.nodes
    .filter((n) => n.role !== VectorRole.Box)
    .map((n) => {
      const zone = zoneOf(ui, n);
      const score = ROLE_WEIGHT[n.role] - (zone === Zone.Nav ? NAV_PENALTY : 0);
      return { id: n.id, role: n.role, zone, score, ...(n.text ? { text: n.text } : {}) };
    })
    .sort((a, b) => b.score - a.score);
}
