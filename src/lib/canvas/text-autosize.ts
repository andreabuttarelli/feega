import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, textBoxesAt, type TextBox } from '@feega/motion-core/motion/gpu-full/display-list';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { fitTexts, freeTextFit, hostFit } from '$lib/motion/text-fit';
import { FrameKind } from './motion-node';
import { ResizeMode, fitToNode } from '$lib/motion/custom-size';
import { stillFrame } from './core/frame-source';
import { freeStackFit } from '$lib/motion/layout/stack-fit';
import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';

type NodeSize = { w: number; h: number };
export type TextFit = { doc?: MotionDoc; node?: NodeSize };
type Boxes = Record<string, TextBox>;

function freeTextBox(doc: MotionDoc, boxes: Boxes, node: NodeSize): TextFit | null {
  const share = freeTextFit(doc, boxes);
  const next = share ? hostFit(node, share) : null;
  const fitted = share && next ? fitToNode(doc, { width: share.width * doc.width, height: share.height * doc.height }, ResizeMode.Element) : null;
  return next && fitted?.ok ? { node: next, doc: fitted.doc } : null;
}

function freeStackBox(doc: MotionDoc, node: NodeSize, measure: TextMeasure): TextFit | null {
  const fit = freeStackFit(doc, measure);
  const next = fit ? hostFit(node, { ...fit.share, stage: { width: doc.width, height: doc.height } }) : null;
  return fit && next ? { node: next, doc: fit.doc } : null;
}

const FIT_BY_KIND: Record<FrameKind, (doc: MotionDoc, boxes: Boxes, node: NodeSize, measure: TextMeasure) => TextFit | null> = {
  [FrameKind.Element]: (doc, boxes, node, measure) => freeTextBox(doc, boxes, node) ?? freeStackBox(doc, node, measure),
  [FrameKind.Frame]: (doc, boxes) => {
    const next = fitTexts(doc, boxes);
    return next ? { doc: next } : null;
  },
  [FrameKind.Group]: () => null
};

export const textAutosize = (doc: MotionDoc, boxes: Boxes, kind: FrameKind, node: NodeSize, measure: TextMeasure = estimatedText): TextFit | null => FIT_BY_KIND[kind](doc, boxes, node, measure);

export async function measuredTexts(doc: MotionDoc, tokens: BrandTokens, assets: Record<string, string>, kind: FrameKind, node: NodeSize): Promise<TextFit | null> {
  const fonts = await loadFonts(doc, assets, tokens);
  const typeset = { fonts, smoothing: Smoothing.Plain };
  const boxes = textBoxesAt(prepare(doc, tokens, assets, typeset), stillFrame(doc));
  return textAutosize(doc, boxes, kind, node, shapedText(typeset));
}

export type FitTargets = { amend: (doc: MotionDoc) => void; show: (doc: MotionDoc) => void; place: (node: NodeSize) => void };

export function applyTextFit(fit: TextFit, to: FitTargets): void {
  if (fit.doc) {
    to.amend(fit.doc);
    to.show(fit.doc);
  }
  if (fit.node) {
    to.place(fit.node);
  }
}
