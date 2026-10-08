import { clipsOf, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { exposeField } from '$lib/motion/template/fields';
import { FieldType, type ExposedField } from '$lib/motion/template/field-model';

type Slot = { type: FieldType; prop: string; key: string; label: (clip: MotionClip, n: number) => string; quota: number };

const LABEL_CHARS = 28;
const COLOUR = /^#[0-9a-f]{6}$/i;

const quoted = (clip: MotionClip) => {
  const text = String(clip.props.text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text;
};

const textSlot: Slot = { type: FieldType.Text, prop: 'text', key: 'text', label: (c) => `Text · ${quoted(c)}`, quota: 4 };

const SLOTS: Readonly<Record<string, Slot>> = {
  Title: textSlot,
  Text: textSlot,
  Kicker: textSlot,
  Logo: { type: FieldType.Asset, prop: 'assetId', key: 'logo', label: (_c, n) => `Logo ${n}`, quota: 1 },
  Image: { type: FieldType.Asset, prop: 'assetId', key: 'picture', label: (_c, n) => `Picture ${n}`, quota: 2 },
  Composition: { type: FieldType.MediaList, prop: 'media', key: 'media', label: (_c, n) => `Pictures and videos ${n}`, quota: 1 },
  Shape: { type: FieldType.Color, prop: 'fill', key: 'colour', label: (_c, n) => `Colour ${n}`, quota: 2 }
};

const exposable = (clip: MotionClip, slot: Slot) => slot.type !== FieldType.Color || COLOUR.test(String(clip.props[slot.prop] ?? ''));

function fieldsFor(doc: MotionDoc): Omit<ExposedField, 'default'>[] {
  const used = new Map<string, number>();
  const ordered = [...clipsOf(doc)].sort((a, b) => a.from - b.from);
  return ordered.flatMap((clip) => {
    const slot = SLOTS[clip.component];
    const n = (used.get(slot?.key ?? '') ?? 0) + 1;
    if (!slot || n > slot.quota || !exposable(clip, slot)) {
      return [];
    }
    used.set(slot.key, n);
    return [{ key: `${slot.key}_${n}`, label: slot.label(clip, n), type: slot.type, clipId: clip.id, prop: slot.prop }];
  });
}

export function exposeMainFields(doc: MotionDoc): MotionDoc {
  if (doc.fields.length) {
    return doc;
  }
  return fieldsFor(doc).reduce((current, field) => {
    const exposed = exposeField(current, field);
    return exposed.ok ? exposed.doc : current;
  }, doc);
}
