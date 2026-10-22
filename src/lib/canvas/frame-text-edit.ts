import type { BrandTokens } from '$lib/motion/brand';
import { resolveColor } from '$lib/motion/brand';
import { Strictness } from '$lib/motion/custom/component';
import { clipProps, findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { fontStack } from '$lib/motion/fonts/model';
import { CLIP_TEXT, editablePart, PartEdit } from '$lib/motion/poster-parts';
import { setProps, type OpResult } from '$lib/motion/timeline';
import { styledComponent } from '$lib/motion/text-run-ops';
import type { RunCase, RunStyle, TextRun } from '$lib/motion/text-runs';
import { mul2d, type Affine } from '$lib/motion/affine';
import type { TextCaret } from '$lib/motion/gpu-full/display-list';
import type { TextCase } from '$lib/motion/components';

type Size = { width: number; height: number };

const TEXT_TRANSFORM: Record<TextCase, string> = { 'as-typed': 'none', upper: 'uppercase', lower: 'lowercase', title: 'capitalize' };

export type TextEditStyle = {
  fontPx: number;
  family: string;
  weight: number;
  italic: boolean;
  trackingEm: number;
  leading: number;
  color: string;
  textTransform: string;
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

export const styledKind = (clip: Pick<MotionClip, 'component'>) => styledComponent(clip.component);

export const runsOfClip = (clip: Pick<MotionClip, 'component' | 'props'>): TextRun[] => (styledKind(clip) ? ((clip.props.runs as TextRun[] | undefined) ?? []) : []);

export function baseStyle(clip: Pick<MotionClip, 'props'>): RunStyle {
  const p = clip.props;
  return { color: String(p.color), weight: Number(p.weight), italic: p.italic === true, font: String(p.font), size: Number(p.size), tracking: Number(p.tracking), leading: Number(p.leading), underline: false, strike: false, textCase: (p.textCase as RunCase | undefined) ?? 'as-typed', opacity: 1 };
}

export function commitText(doc: MotionDoc, clipId: string, text: string, runs: TextRun[] = []): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  return setProps(doc, clipId, clip && styledKind(clip) ? { text, runs: runs.length ? runs : undefined } : { text });
}

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
    textTransform: TEXT_TRANSFORM[(p.textCase as TextCase) ?? 'as-typed'] ?? 'none',
    align: String(p.align)
  };
}

export type EditLayout = { transform: string; width: number; height: number; fontPx: number; wraps: boolean; vertical: number };

export function editLayout(caret: TextCaret, screen: Affine): EditLayout {
  const m = mul2d(screen, caret.matrix);
  return { transform: `matrix(${m.join(',')})`, width: caret.width, height: caret.height, fontPx: caret.size, wraps: caret.flow.wraps, vertical: caret.vertical };
}

const FLOW_CSS: Record<'wraps' | 'line', (layout: EditLayout) => string> = {
  wraps: (layout) => `white-space:pre-wrap;width:${layout.width}px;`,
  line: () => 'white-space:pre;'
};

export function editCss(look: TextEditStyle, layout: EditLayout): string {
  const flow = FLOW_CSS[layout.wraps ? 'wraps' : 'line'](layout);
  const font = `${look.italic ? 'italic ' : ''}${look.weight} ${layout.fontPx}px/${look.leading} ${look.family}`;
  return `left:0;top:0;transform-origin:0 0;transform:${layout.transform};${flow}height:${layout.height}px;font:${font};letter-spacing:${look.trackingEm}em;color:${look.color};caret-color:${look.color};text-align:${look.align};text-transform:${look.textTransform};`;
}
