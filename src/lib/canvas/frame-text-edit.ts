import type { BrandTokens } from '@feega/motion-core/motion/brand';
import { resolveColor } from '@feega/motion-core/motion/brand';
import { Strictness } from '@feega/motion-core/motion/custom/component';
import { clipProps, findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { fontStack, loadedWeight } from '@feega/motion-core/motion/fonts/model';
import { CLIP_TEXT, editablePart, PartEdit } from '@feega/motion-core/motion/poster-parts';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { styledComponent } from '$lib/motion/text-run-ops';
import { normalLists, type ListItem } from '@feega/motion-core/motion/text-lists';
import { type RunCase, type RunStyle, type TextRun } from '@feega/motion-core/motion/text-runs';
import { textBody, TextBodyFor } from '@feega/motion-core/motion/hyperframes/text-body';
import { css, esc } from '@feega/motion-core/motion/hyperframes/html';
import { mul2d, type Affine } from '@feega/motion-core/motion/affine';
import type { TextCaret } from '@feega/motion-core/motion/gpu-full/display-list';
import type { TextCase } from '@feega/motion-core/motion/components';
import { decorationCss } from '@feega/motion-core/motion/decoration';
import { AUTO, CAP_TRIM_CSS, CSS_AUTO, CSS_NORMAL, leadingOf, trackingOf } from '@feega/motion-core/motion/type-units';

type Size = { width: number; height: number };

const TEXT_TRANSFORM: Record<TextCase, string> = { 'as-typed': 'none', upper: 'uppercase', lower: 'lowercase', title: 'capitalize', 'small-caps': 'none' };

export type TextEditStyle = {
  fontPx: number;
  family: string;
  weight: number;
  italic: boolean;
  trackingEm: number;
  leading: number | string;
  color: string;
  textTransform: string;
  align: string;
  wrap: string;
  trim: string;
  decoration: string;
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

export const listsOfClip = (clip: Pick<MotionClip, 'component' | 'props'>): ListItem[] => (styledKind(clip) ? ((clip.props.lists as ListItem[] | undefined) ?? []) : []);

export function baseStyle(clip: Pick<MotionClip, 'props'>): RunStyle {
  const p = clip.props;
  return { color: String(p.color), weight: Number(p.weight), italic: p.italic === true, font: String(p.font), size: Number(p.size), tracking: Number(p.tracking), leading: Number(p.leading), underline: false, strike: false, textCase: (p.textCase as RunCase | undefined) ?? 'as-typed', opacity: 1 };
}

export function commitText(doc: MotionDoc, clipId: string, text: string, runs: TextRun[] = [], lists: ListItem[] = []): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  return setProps(doc, clipId, clip && styledKind(clip) ? { text, runs: runs.length ? runs : undefined, lists: normalLists(lists, text.split('\n').length) } : { text });
}

export function textEditStyle(input: { clip: MotionClip; doc: MotionDoc; tokens: BrandTokens; frame: Size; scale: number }): TextEditStyle {
  const verdict = clipProps(input.doc.components, input.clip.component, input.clip.props, Strictness.Lenient);
  const p = (verdict.ok ? verdict.props : input.clip.props) as Record<string, unknown>;
  const unit = Math.min(input.frame.width, input.frame.height);
  const sizePx = Number(p.size) * unit;
  return {
    fontPx: Number(p.size) * unit * input.scale,
    family: fontStack(String(p.font), input.doc.fonts),
    weight: Number(p.weight),
    italic: p.italic === true,
    trackingEm: trackingOf(p, sizePx),
    leading: leadingOf(p, sizePx) === AUTO ? CSS_NORMAL : leadingOf(p, sizePx),
    color: resolveColor(p.color, input.tokens),
    textTransform: TEXT_TRANSFORM[(p.textCase as TextCase) ?? 'as-typed'] ?? 'none',
    align: String(p.align),
    wrap: p.textWrap === 'balance' || p.textWrap === 'pretty' ? p.textWrap : CSS_AUTO,
    trim: p.leadingTrim === 'cap' ? CAP_TRIM_CSS : CSS_NORMAL,
    decoration: css(decorationCss(p, (v) => resolveColor(v, input.tokens)))
  };
}

export type EditLayout = { transform: string; width: number; height: number; fontPx: number; wraps: boolean; vertical: number };

export function editLayout(caret: TextCaret, screen: Affine): EditLayout {
  const m = mul2d(screen, caret.matrix);
  return { transform: `matrix(${m.join(',')})`, width: caret.width, height: caret.height, fontPx: caret.size, wraps: caret.flow.wraps, vertical: caret.vertical };
}

export const anchorShift = (layout: EditLayout, content: number): number => (layout.height - content) * layout.vertical;

const FLOW_CSS: Record<'wraps' | 'line', (layout: EditLayout) => string> = {
  wraps: (layout) => `white-space:pre-wrap;width:${layout.width}px;`,
  line: () => 'white-space:pre;'
};

export function editCss(look: TextEditStyle, layout: EditLayout): string {
  const flow = FLOW_CSS[layout.wraps ? 'wraps' : 'line'](layout);
  const font = `${look.italic ? 'italic ' : ''}${look.weight} ${layout.fontPx}px/${look.leading} ${look.family}`;
  return `left:0;top:0;transform-origin:0 0;transform:${layout.transform};${flow}height:${layout.height}px;font:${font};letter-spacing:${look.trackingEm}em;color:${look.color};caret-color:${look.color};text-align:${look.align};text-transform:${look.textTransform};text-wrap-style:${look.wrap};text-box:${look.trim};${look.decoration}`;
}

export type EditBody = (text: string, runs: readonly TextRun[], lists: readonly ListItem[]) => string;

const NEWLINE = '\n';

export function editBody(clip: Pick<MotionClip, 'props'>, doc: MotionDoc, tokens: BrandTokens): EditBody {
  const p = clip.props;
  const spacing = Number(p.paragraphSpacing ?? 0);
  const indent = Number(p.paragraphIndent ?? 0);
  return (text, runs, lists) =>
    textBody(
      {
        p: { text, size: Number(p.size), font: String(p.font), runs: [...runs], lists: [...lists], paragraphSpacing: spacing, paragraphIndent: indent },
        text: { id: null, lines: (t) => t.split(NEWLINE).map(esc) },
        color: (v) => resolveColor(v, tokens),
        asset: () => null,
        font: (family) => fontStack(family, doc.fonts),
        weight: (family, weight) => loadedWeight(family, weight, doc.fonts)
      },
      TextBodyFor.Editor
    );
}
