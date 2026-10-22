import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Action } from '$lib/motion/actions';
import { PropertiesView } from '$lib/motion/properties-view';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { FieldType, exposeField } from '$lib/motion/template/fields';
import { insertTemplate, templateFromComp } from '$lib/motion/template/library';
import { precompose } from '$lib/motion/precomp';
import { barAction, inspectorOf } from './frame-inspector';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function fixture(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  return must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Two' } }, 'b'));
}

const ids = () => {
  let n = 0;
  return () => `i${++n}`;
};

describe('inspectorOf', () => {
  it('shows nothing for an empty selection', () => {
    expect(inspectorOf(fixture(), [])).toBeNull();
  });

  it('shows the clip inspector for one element', () => {
    const shown = inspectorOf(fixture(), ['a']);

    expect(shown?.view).toBe(PropertiesView.Clip);
    expect(shown?.clip?.id).toBe('a');
  });

  it('shows the multi inspector for several', () => {
    expect(inspectorOf(fixture(), ['a', 'b'])?.view).toBe(PropertiesView.Multiple);
  });

  it('shows the template fields for an inserted template instance', () => {
    let card = must(precompose(fixture(), ['a'], { comp: 'card', clip: 'p' }, 'Card'));
    card = must(exposeField(card, { key: 'headline', label: 'Headline', type: FieldType.Text, clipId: 'a', prop: 'text' }));
    const template = templateFromComp(card, 'card', { name: 'Card' });
    if (!template.ok) {
      throw new Error(template.error);
    }
    const placed = insertTemplate(newMotionDoc(MotionFormat.Square), { id: 'org:card', template: template.template }, { from: 0, newId: ids() });
    if (!placed.ok) {
      throw new Error(placed.error);
    }

    expect(inspectorOf(placed.doc, [placed.clipId])).toMatchObject({ view: PropertiesView.Template, clip: { id: placed.clipId } });
  });

  it('shows nothing for an id the doc no longer has', () => {
    expect(inspectorOf(fixture(), ['gone'])).toBeNull();
  });
});

describe('barAction', () => {
  const ids = () => 'new1';

  it('deletes the selected clip', () => {
    const done = barAction(Action.Delete, { doc: fixture(), selection: ['a'], frame: 0, newId: ids });

    expect(done?.doc.tracks.flatMap((t) => t.clips).map((c) => c.id)).toEqual(['b']);
  });

  it('duplicates the selected clip', () => {
    const done = barAction(Action.Duplicate, { doc: fixture(), selection: ['a'], frame: 0, newId: ids });

    expect(done?.doc.tracks.flatMap((t) => t.clips)).toHaveLength(3);
  });

  it('ignores actions the canvas panel does not run', () => {
    expect(barAction(Action.OpenComp, { doc: fixture(), selection: ['a'], frame: 0, newId: ids })).toBeNull();
  });
});
