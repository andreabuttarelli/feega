import { findClip, type MotionClip, type MotionDoc } from './doc';
import { PropFormat } from './custom/component';
import { setProps, type OpResult } from './timeline';
import type { MeasuredBox } from './hyperframes/measure';

export const PART_SEP = '#';

export enum PartEdit {
  Text = 'text',
  None = 'none'
}

export type PartBox = { part: string; box: MeasuredBox };
type Pt = [number, number];

const TEXT_FORMATS = new Set<string | undefined>([undefined, PropFormat.Textarea]);
const LINE_BREAK = '\n';

export function partBoxes(boxes: Record<string, MeasuredBox>): { clips: Record<string, MeasuredBox>; parts: Record<string, PartBox[]> } {
  const clips: Record<string, MeasuredBox> = {};
  const parts: Record<string, PartBox[]> = {};
  for (const [key, box] of Object.entries(boxes)) {
    const at = key.indexOf(PART_SEP);
    if (at < 0) {
      clips[key] = box;
      continue;
    }
    const clip = key.slice(0, at);
    parts[clip] = [...(parts[clip] ?? []), { part: key.slice(at + 1), box }];
  }
  return { clips, parts };
}

const holds = (b: MeasuredBox, [x, y]: Pt) => x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;

export function partAt(parts: readonly PartBox[], p: Pt): string | null {
  const under = parts.filter((c) => holds(c.box, p)).sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);
  return under[0]?.part ?? null;
}

export function parsePart(part: string): { field: string; index: number | null } {
  const [field, index] = part.split(':');
  return { field, index: index === undefined ? null : Number(index) };
}

export const CLIP_TEXT = 'text';

const CUSTOM = 'Custom';

export function editablePart(doc: MotionDoc, clip: MotionClip, part: string): PartEdit {
  const { field } = parsePart(part);
  if (clip.component !== CUSTOM) {
    return field === CLIP_TEXT && typeof clip.props[field] === 'string' ? PartEdit.Text : PartEdit.None;
  }
  const spec = doc.components[String(clip.props.name)]?.propsSchema.properties?.[field];
  return spec?.type === 'string' && TEXT_FORMATS.has(spec.format) && typeof clip.props[field] === 'string' ? PartEdit.Text : PartEdit.None;
}

export function partText(clip: MotionClip, part: string): string {
  const { field, index } = parsePart(part);
  const value = String(clip.props[field] ?? '');
  return index === null ? value : (value.split(LINE_BREAK)[index] ?? '');
}

export function writePartText(doc: MotionDoc, clipId: string, part: string, text: string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || editablePart(doc, clip, part) !== PartEdit.Text) {
    return { ok: false, error: `${part} is not a text part of ${clipId}` };
  }
  const { field, index } = parsePart(part);
  const lines = String(clip.props[field]).split(LINE_BREAK);
  const next = index === null ? text : lines.map((line, i) => (i === index ? text.replaceAll(LINE_BREAK, ' ') : line)).join(LINE_BREAK);
  return setProps(doc, clipId, { [field]: next });
}
