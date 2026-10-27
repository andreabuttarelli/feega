import type { FigmaMessage, FigmaRawNode, Guid } from '../../../src/lib/canvas/figma/archive';
import { node, solid } from './elements';

const DOCUMENT = 0;
const PAGE = 1;
const INTERNAL = 2;
const inter = (style: string) => ({ family: 'Inter', style, postscript: '' });

export const NAV_LABELS = ['Sign up', 'Login', 'About us', 'Blog', 'Pricing'];
export const LONG_PARAGRAPH = 'JustGo is the membership that takes the friction out of every trip. '.repeat(14).trim();
export const OVERRIDDEN_LABEL = 'Join now';
export const HIDDEN_ICON = 'Arrow';

const GREEN = { r: 0.1, g: 0.7, b: 0.3, a: 1 };

function copy(): FigmaRawNode[] {
  return [
    { guid: { sessionID: 0, localID: DOCUMENT }, type: 'DOCUMENT', name: 'Document' },
    { guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Landing', parentIndex: { guid: { sessionID: 0, localID: DOCUMENT }, position: 'a' } },
    { guid: { sessionID: 0, localID: INTERNAL }, type: 'CANVAS', name: 'Internal Only Canvas', internalOnly: true, parentIndex: { guid: { sessionID: 0, localID: DOCUMENT }, position: 'b' } }
  ];
}

const text = (parent: number, slot: string, characters: string, extra: Partial<FigmaRawNode> & { x?: number; y?: number; w?: number; h?: number }) =>
  node('TEXT', parent, { w: 120, h: 20, fontName: inter('Regular'), fontSize: 14, fillPaints: [solid(0, 0, 0)], textData: { characters }, slot, ...extra });

const pathOf = (...ids: number[]): { guids: Guid[] } => ({ guids: ids.map((localID) => ({ sessionID: 0, localID })) });

export type Landing = { message: FigmaMessage; texts: string[] };

export function landingPage(): Landing {
  const page = copy();
  const root = node('FRAME', PAGE, { w: 1440, h: 6000, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, name: 'Landing', slot: 'a' });
  const nav = NAV_LABELS.map((label, i) => text(root.id, String.fromCharCode(98 + i), label, { x: 600 + i * 120, y: 24, fontSize: 12 }));
  const unsized = text(root.id, 'h', 'Copyright', { x: 40, y: 5900, fontSize: 0 });
  const tiny = text(root.id, 'i', 'Terms', { x: 200, y: 5900, fontSize: 2 });
  const paragraph = text(root.id, 'j', LONG_PARAGRAPH, { x: 40, y: 600, w: 700, h: 200, fontSize: 18 });

  const main = node('SYMBOL', INTERNAL, { w: 160, h: 48, fillPaints: [solid(0, 0.4, 1)], frameMaskDisabled: false, name: 'Button', slot: 'a' });
  const label = text(main.id, 'a', 'Label', { x: 16, y: 12, w: 80, h: 20, fontSize: 16 });
  const icon = node('RECTANGLE', main.id, { x: 120, y: 14, w: 20, h: 20, fillPaints: [solid(1, 1, 1)], name: HIDDEN_ICON, slot: 'b' });

  const plain = node('INSTANCE', root.id, { x: 40, y: 300, w: 160, h: 48, symbolData: { symbolID: main.guid }, name: 'Button', slot: 'k' });
  const changed = node('INSTANCE', root.id, {
    x: 400,
    y: 300,
    w: 160,
    h: 48,
    name: 'Button',
    slot: 'l',
    symbolData: {
      symbolID: main.guid,
      symbolOverrides: [
        { guidPath: pathOf(label.id), textData: { characters: OVERRIDDEN_LABEL } },
        { guidPath: pathOf(label.id), fillPaints: [{ type: 'SOLID', color: GREEN, opacity: 1, visible: true }] },
        { guidPath: pathOf(icon.id), visible: false }
      ]
    }
  });

  const hero = node('RECTANGLE', root.id, { x: 40, y: 100, w: 600, h: 400, fillPaints: [{ type: 'IMAGE', opacity: 1, visible: true, image: { hash: Uint8Array.from({ length: 20 }, (_, i) => i + 1) } }], name: 'Hero', slot: 'm' });
  const sticky = node('STICKY', root.id, { x: 700, y: 100, w: 120, h: 120, name: 'Note', slot: 'n' });

  const nodes = [...page, root, ...nav, unsized, tiny, paragraph, hero, sticky, main, label, icon, plain, changed];
  return { message: { meta: { fileKey: 'landing' }, blobs: [], nodes }, texts: [...NAV_LABELS, 'Copyright', 'Terms', LONG_PARAGRAPH] };
}
