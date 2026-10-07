import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { mergeView, precompose, viewOf } from '$lib/motion/precomp';
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

  it('a field can name a setting nested in a prop, like a composition layout number', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Composition', from: 0, durationInFrames: 60, props: { layout: 'ring', layoutParams: { turns: 1, tiltX: -10 } } }, 'c1');
    const exposed = added.ok ? exposeField(added.doc, { key: 'turns', label: 'Turns', type: FieldType.Number, clipId: 'c1', prop: 'layoutParams.turns' }) : added;
    const filled = exposed.ok ? applyValues(exposed.doc, { turns: '3' }) : exposed;

    expect(exposed.ok && fieldValues(exposed.doc)[0].value).toBe(1);
    expect(filled.ok && filled.doc.tracks.flatMap((t) => t.clips)[0].props.layoutParams).toEqual({ turns: 3, tiltX: -10 });
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

function precomposedTitle(): MotionDoc {
  const done = precompose(withTitle(), ['t1'], { comp: 'card', clip: 'p1' }, 'Card');
  if (!done.ok) {
    throw new Error(done.error);
  }
  return done.doc;
}

describe('fields inside a precomp', () => {
  it('a clip inside a nested composition can be exposed, listed and filled from the root', () => {
    const exposed = exposeField(precomposedTitle(), headline);
    const filled = exposed.ok ? applyValues(exposed.doc, { headline: 'Inside' }) : exposed;

    expect(filled.ok && fieldValues(filled.doc)[0]).toMatchObject({ key: 'headline', value: 'Inside', missing: false });
    expect(filled.ok && filled.doc.comps.card.tracks[0].clips[0].props.text).toBe('Inside');
  });

  it('a field exposed while editing inside the precomp survives leaving it', () => {
    const root = precomposedTitle();
    const exposed = exposeField(viewOf(root, ['card']), headline);

    expect(exposed.ok && mergeView(root, ['card'], exposed.doc).fields.map((f) => f.key)).toEqual(['headline']);
  });
});

describe('typed fields', () => {
  it('a select field takes only one of its options', () => {
    const exposed = exposeField(withTitle(), { ...headline, key: 'align', type: FieldType.Select, prop: 'align', options: ['left', 'center', 'right'] });

    expect(exposed.ok && applyValues(exposed.doc, { align: 'left' }).ok).toBe(true);
    expect(exposed.ok && applyValues(exposed.doc, { align: 'up' })).toEqual({ ok: false, error: 'align expects one of left, center, right, got "up"' });
  });

  it('a media list field takes asset ids separated by commas, video: marking a video', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Composition', from: 0, durationInFrames: 60 }, 'grid');
    const exposed = added.ok ? exposeField(added.doc, { key: 'media', label: 'Media', type: FieldType.MediaList, clipId: 'grid', prop: 'media' }) : added;
    const filled = exposed.ok ? applyValues(exposed.doc, { media: 'a1, video:v1' }) : exposed;

    expect(filled.ok && fieldValues(filled.doc)[0].value).toEqual([
      { assetId: 'a1', kind: 'image' },
      { assetId: 'v1', kind: 'video' }
    ]);
  });

  it('a number field refuses a value outside its range', () => {
    const exposed = exposeField(withTitle(), { ...headline, key: 'size', type: FieldType.Number, prop: 'size', min: 0.02, max: 0.2 });

    expect(exposed.ok && applyValues(exposed.doc, { size: '0.5' })).toEqual({ ok: false, error: 'size expects a number from 0.02 to 0.2, got "0.5"' });
  });
});
