import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { TrackKind } from '$lib/motion/components';
import { precompose } from '$lib/motion/precomp';
import { addClip, addTrack, type OpResult } from '$lib/motion/timeline';
import { exposeField, FieldType } from './fields';
import { detachTemplate, insertTemplate, isLockedComp, setTemplateValues, templateFields, templateFromComp, templateFromDoc, type MotionTemplate } from './library';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function card(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 't1'));
  doc = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: 60 }, 'pic'));
  doc = must(precompose(doc, ['t1', 'pic'], { comp: 'card', clip: 'p1' }, 'Card'));
  doc = must(exposeField(doc, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' }));
  return must(exposeField(doc, { key: 'photo', label: 'Photo', type: FieldType.Asset, clipId: 'pic', prop: 'assetId', aspect: 1 }));
}

const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};

function inserted(times: number): { doc: MotionDoc; clips: string[] } {
  const template = templateFromComp(card(), 'card', { name: 'Card' });
  if (!template.ok) {
    throw new Error(template.error);
  }
  const ids = counter();
  let doc = newMotionDoc(MotionFormat.Vertical);
  const clips: string[] = [];
  for (let i = 0; i < times; i++) {
    const out = insertTemplate(doc, { id: 'org:card', template: template.template }, { from: i * 30, newId: ids });
    if (!out.ok) {
      throw new Error(out.error);
    }
    doc = out.doc;
    clips.push(out.clipId);
  }
  return { doc, clips };
}

describe('a template from a precomp', () => {
  it('holds the precomp content and its exposed fields', () => {
    const made = templateFromComp(card(), 'card', { name: 'Card' });

    expect(made.ok && made.template.doc.tracks.flatMap((t) => t.clips.map((c) => c.id)).sort()).toEqual(['pic', 't1']);
    expect(made.ok && made.template.doc.fields.map((f) => f.key)).toEqual(['headline', 'photo']);
  });

  it('a precomp with no exposed field is refused: nothing could be customised', () => {
    const doc = must(precompose(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 't1')), ['t1'], { comp: 'c', clip: 'p' }, 'C'));

    expect(templateFromComp(doc, 'c', { name: 'C' })).toMatchObject({ ok: false, error: expect.stringMatching(/expose/) });
  });

  it('a whole video becomes a template without its audio tracks', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 't1'));
    doc = must(addTrack(doc, TrackKind.Audio, 'music'));
    doc = must(exposeField(doc, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 't1', prop: 'text' }));

    const made = templateFromDoc(doc, { name: 'Whole' });

    expect(made.ok && made.template.doc.tracks.map((t) => t.kind)).toEqual([TrackKind.Visual]);
  });
});

describe('inserting a template', () => {
  it('lands as one locked Precomp clip whose composition is a fresh copy', () => {
    const { doc, clips } = inserted(1);
    const comp = String(doc.tracks[0].clips[0].props.comp);

    expect(doc.tracks[0].clips[0]).toMatchObject({ id: clips[0], component: 'Precomp' });
    expect(isLockedComp(doc, comp)).toBe(true);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('three inserts are three independent instances, each with its own fields', () => {
    let { doc, clips } = inserted(3);
    doc = must(setTemplateValues(doc, clips[1], { headline: 'Second', photo: 'asset-2' }));

    expect(templateFields(doc, clips[0]).map((f) => [f.key, f.value])).toEqual([
      ['headline', 'Hello'],
      ['photo', null]
    ]);
    expect(templateFields(doc, clips[1]).map((f) => [f.key, f.value])).toEqual([
      ['headline', 'Second'],
      ['photo', 'asset-2']
    ]);
    expect(doc.fields.map((f) => f.key)).toEqual(['headline', 'photo', 'headline_2', 'photo_2', 'headline_3', 'photo_3']);
  });

  it('a value outside the template schema is refused with the field it belongs to', () => {
    const { doc, clips } = inserted(1);

    expect(setTemplateValues(doc, clips[0], { nope: 'x' })).toEqual({ ok: false, error: 'no field nope: this template has headline, photo' });
  });

  it('a nested precomp inside the template is copied too, and points at its copy', () => {
    let doc = card();
    doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30 }, 'dot'));
    doc = must(precompose(doc, ['dot'], { comp: 'inner', clip: 'pi' }, 'Inner'));
    const outer = must(precompose(doc, ['p1', 'pi'], { comp: 'outer', clip: 'po' }, 'Outer'));
    const made = templateFromComp(outer, 'outer', { name: 'Nested' });
    const template = made.ok ? made.template : (null as unknown as MotionTemplate);

    const out = insertTemplate(newMotionDoc(MotionFormat.Landscape), { id: 'org:nested', template }, { from: 0, newId: counter() });
    const placed = out.ok ? out.doc : newMotionDoc(MotionFormat.Landscape);
    const refs = Object.values(placed.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.filter((x) => x.component === 'Precomp').map((x) => String(x.props.comp))));

    expect(Object.keys(placed.comps)).toHaveLength(3);
    expect(refs.every((r) => placed.comps[r])).toBe(true);
    expect(parseMotionDoc(placed).ok).toBe(true);
  });
});

describe('detaching', () => {
  it('unlocks the structure and keeps everything in place', () => {
    const { doc, clips } = inserted(1);
    const comp = String(doc.tracks[0].clips[0].props.comp);

    const detached = must(detachTemplate(doc, clips[0]));

    expect(isLockedComp(detached, comp)).toBe(false);
    expect(detached.comps[comp].tracks).toEqual(doc.comps[comp].tracks);
  });
});
