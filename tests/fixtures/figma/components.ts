import type { FigmaMessage, FigmaRawNode } from '../../../src/lib/canvas/figma/archive';
import { node, solid } from './elements';

const PAGE = 1;
const SMALL_TEXT_SIZE = 12;
const inter = (style: string) => ({ family: 'Inter', style, postscript: '' });
const pageNode = (): FigmaRawNode => ({ guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' });

export function smallTextInHugeFrame(): FigmaMessage {
  const poster = node('FRAME', PAGE, { w: 6000, h: 4000, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, slot: 'a' });
  const caption = node('TEXT', poster.id, { x: 100, y: 100, w: 80, h: 16, fontName: inter('Regular'), fontSize: SMALL_TEXT_SIZE, fillPaints: [solid(0, 0, 0)], textData: { characters: 'Caption' }, slot: 'a' });
  return { meta: {}, blobs: [], nodes: [pageNode(), poster, caption] };
}

function button(parent: number, type: string, at: { x: number; y: number }, extra: Partial<FigmaRawNode> & { slot?: string }) {
  const box = node(type, parent, { ...at, w: 160, h: 48, fillPaints: [solid(0, 0.4, 1)], frameMaskDisabled: false, name: 'Button', ...extra });
  const label = node('TEXT', box.id, { x: 16, y: 12, w: 80, h: 20, fontName: inter('Bold'), fontSize: 16, fillPaints: [solid(1, 1, 1)], textData: { characters: 'Buy' }, slot: 'a' });
  return [box, label];
}

export function buttonInstances(options: { mainCopied: boolean }): FigmaMessage {
  const screen = node('FRAME', PAGE, { w: 1440, h: 900, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, slot: 'a' });
  const [main, mainLabel] = button(screen.id, 'SYMBOL', { x: 1000, y: 700 }, { slot: 'a' });
  const symbolData = { symbolID: main.guid };
  const first = button(screen.id, 'INSTANCE', { x: 100, y: 100 }, { symbolData, slot: 'b' });
  const second = button(screen.id, 'INSTANCE', { x: 400, y: 300 }, { symbolData, slot: 'c' });
  return { meta: {}, blobs: [], nodes: [pageNode(), screen, ...(options.mainCopied ? [main, mainLabel] : []), ...first, ...second] };
}
