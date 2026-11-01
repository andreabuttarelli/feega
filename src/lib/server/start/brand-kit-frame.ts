import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { SiteKit } from './brand-from-site';

export const KIT_SIZE = { width: 960, height: 600 };

const SPAN = 150;
const PAD = 64;
const SWATCH = 88;
const GAP = 16;
const INK = '#111111';
const SOFT = '#6e6e73';
const PAPER = '#ffffff';
const LINE = '#e5e5e5';

type Box = { x: number; y: number; w: number; h: number };

const { width: W, height: H } = KIT_SIZE;
const frac = (b: Box) => ({ x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H, width: b.w / W, height: b.h / H });

const rect = (id: string, b: Box, color: string) => ({ id, from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', ...frac(b), fills: [{ type: 'solid', color }] } });
const label = (id: string, text: string, b: Box, px: number, color: string) => ({ id, from: 0, durationInFrames: SPAN, component: 'Text', props: { text, size: px / Math.min(W, H), ...frac(b), color, font: 'sans' } });

function swatches(kit: SiteKit, top: number) {
  return kit.palette.flatMap((swatch, i) => {
    const x = PAD + i * (SWATCH + GAP);
    return [rect(`swatch-${i}`, { x, y: top, w: SWATCH, h: SWATCH }, swatch.hex), label(`swatch-${i}-hex`, swatch.hex, { x, y: top + SWATCH + 8, w: SWATCH, h: 18 }, 12, SOFT)];
  });
}

function fonts(kit: SiteKit, top: number) {
  return kit.fonts.map((name, i) => label(`font-${i}`, name, { x: PAD, y: top + i * 44, w: W - PAD * 2, h: 36 }, 28, INK));
}

function logo(assetId: string | null) {
  if (!assetId) {
    return [];
  }
  return [{ id: 'logo', from: 0, durationInFrames: SPAN, component: 'Image', props: { assetId, fit: 'contain', ...frac({ x: W - PAD - 160, y: PAD, w: 160, h: 64 }) } }];
}

export function brandKitDoc(kit: SiteKit, logoAssetId: string | null): MotionDoc {
  const clips = [
    rect('kit', { x: 0, y: 0, w: W, h: H }, PAPER),
    label('name', kit.name, { x: PAD, y: PAD, w: W - PAD * 2 - 180, h: 56 }, 44, INK),
    rect('rule', { x: PAD, y: PAD + 80, w: W - PAD * 2, h: 1 }, LINE),
    label('colours', 'colours', { x: PAD, y: 176, w: 200, h: 20 }, 13, SOFT),
    ...swatches(kit, 208),
    label('type', 'type', { x: PAD, y: 360, w: 200, h: 20 }, 13, SOFT),
    ...fonts(kit, 392),
    ...logo(logoAssetId)
  ];
  return { version: 5, fps: 30, width: W, height: H, durationInFrames: SPAN, still: { frame: 0 }, tracks: [{ id: 'kit', kind: 'visual', name: 'Brand kit', clips }], comps: {}, assets: [] } as unknown as MotionDoc;
}
