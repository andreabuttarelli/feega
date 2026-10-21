import type { BrandTokens } from '$lib/motion/brand';
import { resolveColor } from '$lib/motion/brand';
import { Strictness } from '$lib/motion/custom/component';
import { clipProps, findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { fontStack } from '$lib/motion/fonts/model';
import { CLIP_TEXT, editablePart, PartEdit } from '$lib/motion/poster-parts';
import { setProps, type OpResult } from '$lib/motion/timeline';

type Size = { width: number; height: number };

export type TextEditStyle = {
  fontPx: number;
  family: string;
  weight: number;
  italic: boolean;
  trackingEm: number;
  leading: number;
  color: string;
  upper: boolean;
  align: string;
};

export function editsText(doc: MotionDoc, clipId: string): boolean {
  const found = findClip(doc, clipId);
  return !!found && editablePart(doc, found.clip as MotionClip, CLIP_TEXT) === PartEdit.Text;
}

export const hideText = (doc: MotionDoc, clipId: string): MotionDoc => {
  const hidden = setProps(doc, clipId, { text: '' });
  return hidden.ok ? hidden.doc : doc;
};

export const commitText = (doc: MotionDoc, clipId: string, text: string): OpResult => setProps(doc, clipId, { text });

export function textEditStyle(input: { clip: MotionClip; doc: MotionDoc; tokens: BrandTokens; frame: Size; scale: number }): TextEditStyle {
  const verdict = clipProps(input.doc.components, input.clip.component, input.clip.props, Strictness.Lenient);
  const p = (verdict.ok ? verdict.props : input.clip.props) as Record<string, unknown>;
  const unit = Math.min(input.frame.width, input.frame.height);
  return {
    fontPx: Number(p.size) * unit * input.scale,
    family: fontStack(String(p.font), input.doc.fonts),
    weight: Number(p.weight),
    italic: p.italic === true,
    trackingEm: Number(p.tracking),
    leading: Number(p.leading),
    color: resolveColor(p.color, input.tokens),
    upper: p.textCase === 'upper',
    align: String(p.align)
  };
}
