import { findClip, type MotionClip, type MotionDoc } from './doc';
import { PropFormat } from './custom/component';
import { setProps, type OpResult } from './timeline';
import type { MeasuredBox } from './hyperframes/measure';
import { LineEdit, editLines, lineRows, markedPoster, removePhoto, wordsOf } from './poster-lines';

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

export const CUSTOM_CLIP = 'Custom';

export function editablePart(doc: MotionDoc, clip: MotionClip, part: string): PartEdit {
  const { field } = parsePart(part);
  if (clip.component !== CUSTOM_CLIP) {
    return field === CLIP_TEXT && typeof clip.props[field] === 'string' ? PartEdit.Text : PartEdit.None;
  }
  const spec = doc.components[String(clip.props.name)]?.propsSchema.properties?.[field];
  return spec?.type === 'string' && TEXT_FORMATS.has(spec.format) && typeof clip.props[field] === 'string' ? PartEdit.Text : PartEdit.None;
}

const isMarkedLines = (clip: MotionClip, field: string) => clip.component === CUSTOM_CLIP && markedPoster(String(clip.props.name))?.lines === field;

export function partText(clip: MotionClip, part: string): string {
  const { field, index } = parsePart(part);
  const value = String(clip.props[field] ?? '');
  const line = index === null ? value : (value.split(LINE_BREAK)[index] ?? '');
  return isMarkedLines(clip, field) ? wordsOf(line) : line;
}

export function writePartText(doc: MotionDoc, clipId: string, part: string, text: string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || editablePart(doc, clip, part) !== PartEdit.Text) {
    return { ok: false, error: `${part} is not a text part of ${clipId}` };
  }
  const { field, index } = parsePart(part);
  if (index !== null && isMarkedLines(clip, field)) {
    const poster = markedPoster(String(clip.props.name))!;
    return setProps(doc, clipId, editLines({ lines: String(clip.props[field]), media: clip.props[poster.media] }, index, LineEdit.Text, text));
  }
  const lines = String(clip.props[field]).split(LINE_BREAK);
  const next = index === null ? text : lines.map((line, i) => (i === index ? text.replaceAll(LINE_BREAK, ' ') : line)).join(LINE_BREAK);
  return setProps(doc, clipId, { [field]: next });
}

export enum PartKind {
  Text = 'text',
  Line = 'line',
  Photo = 'photo',
  Arrow = 'arrow',
  Other = 'other'
}

export const PHOTO_PART = 'photos';
export const ARROW_PART = 'arrow';
const LABEL_MAX = 21;
const ELLIPSIS = '…';

type PartLook = { label: (doc: MotionDoc, clip: MotionClip, part: string) => string; icon: string };

const indexOf = (part: string) => (parsePart(part).index ?? 0) + 1;
const cut = (text: string) => (text.length > LABEL_MAX ? text.slice(0, LABEL_MAX).trimEnd() + ELLIPSIS : text);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fieldTitle = (doc: MotionDoc, clip: MotionClip, field: string) => doc.components[String(clip.props.name)]?.propsSchema.properties?.[field]?.title ?? capital(field);

const PART_LOOK: Record<PartKind, PartLook> = {
  [PartKind.Line]: { label: (_doc, clip, part) => cut(partText(clip, part).trim()) || `Line ${indexOf(part)}`, icon: 'text' },
  [PartKind.Text]: { label: (doc, clip, part) => fieldTitle(doc, clip, parsePart(part).field), icon: 'text' },
  [PartKind.Photo]: { label: (_doc, _clip, part) => `Photo ${indexOf(part)}`, icon: 'image' },
  [PartKind.Arrow]: { label: () => 'Arrow', icon: 'arrow' },
  [PartKind.Other]: { label: (doc, clip, part) => (parsePart(part).index === null ? fieldTitle(doc, clip, parsePart(part).field) : `Line ${indexOf(part)}`), icon: 'part' }
};

const MARKED_KIND: Record<string, PartKind> = { [PHOTO_PART]: PartKind.Photo, [ARROW_PART]: PartKind.Arrow };

export function partKind(doc: MotionDoc, clip: MotionClip, part: string): PartKind {
  const { field, index } = parsePart(part);
  const marked = clip.component === CUSTOM_CLIP && markedPoster(String(clip.props.name));
  if (marked && MARKED_KIND[field]) {
    return MARKED_KIND[field];
  }
  if (editablePart(doc, clip, part) !== PartEdit.Text) {
    return PartKind.Other;
  }
  return index === null ? PartKind.Text : PartKind.Line;
}

export enum PartAction {
  InsertPhoto = 'insert-photo',
  Delete = 'delete'
}

export const PART_ACTION_LOOK: Record<PartAction, { label: string; keepsPart: boolean }> = {
  [PartAction.InsertPhoto]: { label: 'Insert photo after', keepsPart: true },
  [PartAction.Delete]: { label: 'Delete', keepsPart: false }
};

type Marked = { lines: string; media: unknown };
type PartOp = (current: Marked, index: number) => { lines: string; media: unknown };

const withoutArrow: PartOp = (current, i) => (lineRows(current.lines)[i]?.arrow ? editLines(current, i, LineEdit.Arrow) : current);

const PART_OPS: Record<PartKind, Partial<Record<PartAction, PartOp>>> = {
  [PartKind.Line]: { [PartAction.InsertPhoto]: (current, i) => editLines(current, i, LineEdit.AddPhoto) },
  [PartKind.Photo]: { [PartAction.Delete]: removePhoto },
  [PartKind.Arrow]: { [PartAction.Delete]: withoutArrow },
  [PartKind.Text]: {},
  [PartKind.Other]: {}
};

export const PART_ACTIONS = Object.fromEntries(Object.entries(PART_OPS).map(([kind, ops]) => [kind, Object.keys(ops)])) as Record<PartKind, PartAction[]>;

export function runPart(doc: MotionDoc, clip: MotionClip, part: string, action: PartAction): OpResult {
  const op = PART_OPS[partKind(doc, clip, part)][action];
  const poster = markedPoster(String(clip.props.name));
  if (!op || !poster) {
    return { ok: false, error: `${part} cannot ${action}` };
  }
  const next = op({ lines: String(clip.props[poster.lines] ?? ''), media: clip.props[poster.media] }, parsePart(part).index ?? 0);
  return setProps(doc, clip.id, { [poster.lines]: next.lines, [poster.media]: next.media });
}

export const partLabel =(doc: MotionDoc, clip: MotionClip, part: string): string => PART_LOOK[partKind(doc, clip, part)].label(doc, clip, part);

export const partIcon = (doc: MotionDoc, clip: MotionClip, part: string): string => PART_LOOK[partKind(doc, clip, part)].icon;

export const componentLabel = (name: string): string => capital(name.replace(/(?<=[a-z0-9])([A-Z])/g, ' $1').toLowerCase());
