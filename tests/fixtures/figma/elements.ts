import type { FigmaMessage, FigmaRawNode, Matrix, Paint } from '../../../src/lib/canvas/figma/archive';

const PAGE = 1;
const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
const at = (x: number, y: number, degrees = 0): Matrix => {
  const t = (degrees * Math.PI) / 180;
  return { m00: Math.cos(t), m01: -Math.sin(t), m02: x, m10: Math.sin(t), m11: Math.cos(t), m12: y };
};

export const solid = (r: number, g: number, b: number): Paint => ({ type: 'SOLID', color: rgb(r, g, b), opacity: 1, visible: true });
export const gradient = (type: string): Paint => ({ type, opacity: 1, visible: true, stops: [{ color: rgb(1, 0, 0), position: 0 }, { color: rgb(0, 0, 1), position: 1 }], transform: at(0, 0) });

let next = 10;

export function node(type: string, parent: number, extra: Partial<FigmaRawNode> & { x?: number; y?: number; degrees?: number; w?: number; h?: number; slot?: string }): FigmaRawNode & { id: number } {
  const { x = 0, y = 0, degrees = 0, w = 100, h = 100, slot = 'a', ...rest } = extra;
  const id = next++;
  return { id, guid: { sessionID: 0, localID: id }, type, name: `${type.toLowerCase()}-${id}`, size: { x: w, y: h }, transform: at(x, y, degrees), parentIndex: { guid: { sessionID: 0, localID: parent }, position: slot }, visible: true, opacity: 1, ...rest };
}

export function elementsOnly(): FigmaMessage {
  next = 10;
  const page: FigmaRawNode = { guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' };
  const rect = node('ROUNDED_RECTANGLE', PAGE, { x: 100, y: 100, w: 200, h: 120, degrees: 30, cornerRadius: 12, fillPaints: [solid(1, 0.2, 0), gradient('GRADIENT_ANGULAR')], strokePaints: [solid(0, 0, 0), solid(1, 1, 1)], strokeWeight: 4, slot: 'a' });
  const ellipse = node('ELLIPSE', PAGE, { x: 500, y: 100, w: 80, h: 80, fillPaints: [solid(0, 0.4, 1)], slot: 'b' });
  const label = node('TEXT', PAGE, { x: 100, y: 400, w: 160, h: 40, degrees: -90, fontName: { family: 'Inter', style: 'Bold', postscript: '' }, fontSize: 32, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Hello' }, slot: 'c' });
  const group = node('GROUP', PAGE, { x: 600, y: 300, w: 140, h: 60, slot: 'd' });
  const left = node('ROUNDED_RECTANGLE', group.id, { x: 0, y: 0, w: 60, h: 60, fillPaints: [solid(0, 1, 0)], slot: 'a' });
  const right = node('ROUNDED_RECTANGLE', group.id, { x: 80, y: 0, w: 60, h: 60, fillPaints: [solid(1, 0, 1)], slot: 'b' });
  return { meta: {}, blobs: [], nodes: [page, rect, ellipse, label, group, left, right] };
}

export function cardOverElements(): FigmaMessage {
  const base = elementsOnly();
  const card = node('FRAME', PAGE, {
    x: 800,
    y: 100,
    w: 240,
    h: 120,
    fillPaints: [solid(1, 1, 1)],
    frameMaskDisabled: false,
    stackMode: 'HORIZONTAL',
    stackSpacing: 16,
    stackHorizontalPadding: 20,
    stackVerticalPadding: 12,
    stackPaddingRight: 24,
    stackPaddingBottom: 14,
    stackPrimaryAlignItems: 'SPACE_EVENLY',
    stackCounterAlignItems: 'CENTER',
    stackPrimarySizing: 'FIXED',
    stackCounterSizing: 'RESIZE_TO_FIT',
    slot: 'e'
  });
  const avatar = node('ELLIPSE', card.id, { x: 20, y: 12, w: 40, h: 40, fillPaints: [solid(0, 0, 0)], slot: 'a' });
  const title = node('TEXT', card.id, { x: 76, y: 20, w: 80, h: 20, fontName: { family: 'Inter', style: 'Regular', postscript: '' }, fontSize: 16, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Card' }, stackChildPrimaryGrow: 1, slot: 'b' });
  return { ...base, nodes: [...base.nodes, card, avatar, title] };
}

const pageNode = (): FigmaRawNode => ({ guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' });

export function landingWithUnsupported(): FigmaMessage {
  next = 10;
  const landing = node('FRAME', PAGE, { w: 1440, h: 900, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, slot: 'a' });
  const hero = node('TEXT', landing.id, { x: 80, y: 80, w: 400, h: 60, fontName: { family: 'Inter', style: 'Bold', postscript: '' }, fontSize: 48, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Hello' }, slot: 'a' });
  const sticky = node('STICKY', landing.id, { x: 600, y: 80, w: 200, h: 200, slot: 'b' });
  const table = node('TABLE', landing.id, { x: 80, y: 400, w: 600, h: 300, slot: 'c' });
  const cta = node('ROUNDED_RECTANGLE', landing.id, { x: 80, y: 200, w: 160, h: 48, cornerRadius: 8, fillPaints: [solid(0, 0.4, 1)], slot: 'e' });
  return { meta: {}, blobs: [], nodes: [pageNode(), landing, hero, sticky, table, cta] };
}

export function unsupportedBesideElement(): FigmaMessage {
  next = 10;
  const sticky = node('STICKY', PAGE, { w: 200, h: 200, slot: 'a' });
  const dot = node('ELLIPSE', PAGE, { x: 400, w: 80, h: 80, fillPaints: [solid(0, 0.4, 1)], slot: 'b' });
  return { meta: {}, blobs: [], nodes: [pageNode(), sticky, dot] };
}

export function onlyUnsupported(): FigmaMessage {
  next = 10;
  return { meta: {}, blobs: [], nodes: [pageNode(), node('STICKY', PAGE, { w: 200, h: 200, slot: 'a' })] };
}

export function nestedAutoLayout(): FigmaMessage {
  next = 10;
  const stack = { stackMode: 'VERTICAL', stackSpacing: 12, stackHorizontalPadding: 16, stackVerticalPadding: 16 };
  const page = node('FRAME', PAGE, { w: 1440, h: 900, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, ...stack, slot: 'a' });
  const section = node('FRAME', page.id, { w: 600, h: 300, fillPaints: [solid(0.9, 0.9, 0.9)], frameMaskDisabled: false, ...stack, slot: 'a' });
  const row = node('FRAME', section.id, { w: 400, h: 100, fillPaints: [solid(0.8, 0.8, 1)], frameMaskDisabled: false, ...stack, stackMode: 'HORIZONTAL', slot: 'a' });
  const label = node('TEXT', row.id, { w: 80, h: 20, fontName: { family: 'Inter', style: 'Regular', postscript: '' }, fontSize: 16, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Nested' }, slot: 'a' });
  return { meta: {}, blobs: [], nodes: [pageNode(), page, section, row, label] };
}
