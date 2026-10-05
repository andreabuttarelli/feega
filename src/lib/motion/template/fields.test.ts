import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { applyValues, exposeField, FieldType, fieldValues, removeField } from './fields';

function withTitle(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 't1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const headline = { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' };

describe('exposed fields', () => {
  it('a clip prop becomes a named field whose default is what the clip shows now', () => {
    const exposed = exposeField(withTitle(), headline);

    expect(exposed.ok && fieldValues(exposed.doc)).toEqual([{ ...headline, default: 'Hello', value: 'Hello', missing: false }]);
    expect(exposed.ok && motionDocSchema.safeParse(exposed.doc).success).toBe(true);
  });

  it('exposing the same key again replaces the field, removing it drops it', () => {
    const once = exposeField(withTitle(), headline);
    const twice = once.ok ? exposeField(once.doc, { ...headline, label: 'Title line' }) : once;

    expect(twice.ok && twice.doc.fields.map((f) => f.label)).toEqual(['Title line']);
    const removed = twice.ok ? removeField(twice.doc, 'headline') : twice;
    expect(removed.ok && removed.doc.fields).toEqual([]);
  });

  it('a field on a clip that does not exist is refused', () => {
    expect(exposeField(withTitle(), { ...headline, clipId: 'nope' })).toEqual({ ok: false, error: expect.stringMatching(/nope/) });
  });

  it('a key that is not a short snake_case name is refused, so it can name a CSV column and a file', () => {
    expect(exposeField(withTitle(), { ...headline, key: 'Head Line!' })).toMatchObject({ ok: false });
  });

  it('a field whose clip was deleted later is listed as missing, not dropped in silence', () => {
    const exposed = exposeField(withTitle(), headline);
    const doc = exposed.ok ? { ...exposed.doc, tracks: exposed.doc.tracks.map((t) => ({ ...t, clips: [] })) } : withTitle();

    expect(fieldValues(doc)[0]).toMatchObject({ key: 'headline', missing: true, value: null });
  });
});

describe('applyValues', () => {
  it('writes each value into its clip prop, typed by the field', () => {
    const exposed = exposeField(withTitle(), headline);
    const filled = exposed.ok ? applyValues(exposed.doc, { headline: 'Summer sale' }) : exposed;

    expect(filled.ok && fieldValues(filled.doc)[0].value).toBe('Summer sale');
  });

  it('an empty value keeps the default', () => {
    const exposed = exposeField(withTitle(), headline);
    const filled = exposed.ok ? applyValues(exposed.doc, { headline: '' }) : exposed;

    expect(filled.ok && fieldValues(filled.doc)[0].value).toBe('Hello');
  });

  it('a value that is not its type says which field and what it expects', () => {
    const exposed = exposeField(withTitle(), { ...headline, key: 'size', type: FieldType.Number, prop: 'size' });

    expect(exposed.ok && applyValues(exposed.doc, { size: 'big' })).toEqual({ ok: false, error: 'size expects a number, got "big"' });
  });
});
