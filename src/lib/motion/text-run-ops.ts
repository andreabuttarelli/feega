import { COMPONENTS } from './components';
import { findClip, type MotionDoc } from './doc';
import { codePoints, styledRange, type Range, type RunEdit, type TextRun } from './text-runs';
import { setProps, type OpResult } from './timeline';

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
