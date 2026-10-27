import { COMPONENTS } from '@feega/motion-core/motion/components';
import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { listChanged, normalLists, type ListChange, type ListItem } from '@feega/motion-core/motion/text-lists';
import { codePoints, styledRange, type Range, type RunEdit, type TextRun } from '@feega/motion-core/motion/text-runs';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';

const fail = (error: string): OpResult => ({ ok: false, error });

export const styledComponent = (component: string) => 'runs' in ((COMPONENTS as Record<string, { schema: { shape: object } }>)[component]?.schema.shape ?? {});

export function styleTextRange(doc: MotionDoc, clipId: string, range: Range, edit: RunEdit): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  if (!styledComponent(clip.component)) {
    return fail(`${clip.component} has no styled ranges: only Text does`);
  }
  const length = codePoints(String(clip.props.text ?? '')).length;
  if (range.start < 0 || range.end > length || range.start >= range.end) {
    return fail(`range ${range.start}..${range.end} is outside the text (0..${length})`);
  }
  return setProps(doc, clipId, { runs: styledRange(clip.props.runs as TextRun[] | undefined, range, edit, length) });
}

export const clearTextRuns = (doc: MotionDoc, clipId: string): OpResult => setProps(doc, clipId, { runs: undefined });

export function listTextRange(doc: MotionDoc, clipId: string, range: Range, change: ListChange): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  if (!('lists' in ((COMPONENTS as Record<string, { schema: { shape: object } }>)[clip.component]?.schema.shape ?? {}))) {
    return fail(`${clip.component} has no lists: only Text does`);
  }
  const text = String(clip.props.text ?? '');
  const length = codePoints(text).length;
  if (range.start < 0 || range.end > length || range.start > range.end) {
    return fail(`range ${range.start}..${range.end} is outside the text (0..${length})`);
  }
  const lists = listChanged((clip.props.lists as ListItem[] | undefined) ?? [], text, range, change);
  return setProps(doc, clipId, { lists: normalLists(lists, text.split('\n').length) });
}
