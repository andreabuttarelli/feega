import type { BrandTokens } from '$lib/motion/brand';
import type { MotionDoc } from '$lib/motion/doc';
import { prepare, textBoxesAt, type TextBox } from '$lib/motion/gpu-full/display-list';
import { loadFonts } from '$lib/motion/gpu-full/text/load';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { fitTexts, freeTextFit, hostFit } from '$lib/motion/text-fit';
import { FrameKind } from './motion-node';
import { ResizeMode, fitToNode } from '$lib/motion/custom-size';
import { stillFrame } from './core/frame-source';

type NodeSize = { w: number; h: number };
export type TextFit = { doc?: MotionDoc; node?: NodeSize };
type Boxes = Record<string, TextBox>;

const FIT_BY_KIND: Record<FrameKind, (doc: MotionDoc, boxes: Boxes, node: NodeSize) => TextFit | null> = {
  [FrameKind.Element]: (doc, boxes, node) => {
    const share = freeTextFit(doc, boxes);
    const next = share ? hostFit(node, share) : null;
    const fitted = share && next ? fitToNode(doc, { width: share.width * doc.width, height: share.height * doc.height }, ResizeMode.Element) : null;
    return next && fitted?.ok ? { node: next, doc: fitted.doc } : null;
  },
  [FrameKind.Frame]: (doc, boxes) => {
    const next = fitTexts(doc, boxes);
    return next ? { doc: next } : null;
  },
  [FrameKind.Group]: () => null
};

export const textAutosize = (doc: MotionDoc, boxes: Boxes, kind: FrameKind, node: NodeSize): TextFit | null => FIT_BY_KIND[kind](doc, boxes, node);

export async function measuredTexts(doc: MotionDoc, tokens: BrandTokens, assets: Record<string, string>, kind: FrameKind, node: NodeSize): Promise<TextFit | null> {
  const fonts = await loadFonts(doc, assets, tokens);
  const boxes = textBoxesAt(prepare(doc, tokens, assets, { fonts, smoothing: Smoothing.Plain }), stillFrame(doc));
  return textAutosize(doc, boxes, kind, node);
}
