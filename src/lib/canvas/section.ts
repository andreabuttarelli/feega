import { layoutOf } from './node-layout';

export const SECTION_PAD = 40;
export const SECTION_TITLE_H = 40;
export const SECTION_TYPE = 'section';

export enum DeleteMode {
  WithContents = 'with-contents',
  KeepContents = 'keep-contents'
}

type Box = { left: number; top: number; width: number; height: number };
type Holder = { id: string; type: string; data: Record<string, unknown> };

export function sectionBoxAround(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left: left - SECTION_PAD, top: top - SECTION_PAD - SECTION_TITLE_H, width: right - left + 2 * SECTION_PAD, height: bottom - top + 2 * SECTION_PAD + SECTION_TITLE_H };
}

export const membersOf = (nodes: readonly Holder[], sectionId: string): string[] => nodes.filter((n) => layoutOf(n.data).groupId === sectionId).map((n) => n.id);

export function withMembers(nodes: readonly Holder[], ids: readonly string[]): string[] {
  const sections = new Set(nodes.filter((n) => ids.includes(n.id) && n.type === SECTION_TYPE).map((n) => n.id));
  const held = nodes.filter((n) => sections.has(layoutOf(n.data).groupId ?? '')).map((n) => n.id);
  return [...new Set([...ids, ...held])];
}
