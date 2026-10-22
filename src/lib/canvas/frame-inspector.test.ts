import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Action } from '$lib/motion/actions';
import { PropertiesView } from '$lib/motion/properties-view';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { FieldType, exposeField } from '$lib/motion/template/fields';
import { insertTemplate, templateFromComp } from '$lib/motion/template/library';
import { precompose } from '$lib/motion/precomp';
import { FRAME_ELEMENT_MENU, barAction, frameBarActions, frameKeyAction, inspectorOf, picksFor } from './frame-inspector';
import { findClip } from '$lib/motion/doc';
import { addTrack } from '$lib/motion/timeline';
import { TrackKind } from '$lib/motion/components';

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

const fresh = () => {
  let n = 0;
  return () => `n${++n}`;
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

  it('flips the selected clips horizontally and vertically', () => {
    const scale = (doc: MotionDoc | undefined, key: 'scaleX' | 'scaleY') => doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'a')?.transform[key];

    expect(scale(barAction(Action.FlipHorizontal, { doc: fixture(), selection: ['a'], frame: 0, newId: ids })?.doc, 'scaleX')).toBe(-1);
    expect(scale(barAction(Action.FlipVertical, { doc: fixture(), selection: ['a'], frame: 0, newId: ids })?.doc, 'scaleY')).toBe(-1);
  });

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

  it('groups two elements into one group and selects it', () => {
    const done = barAction(Action.Group, { doc: fixture(), selection: ['a', 'b'], frame: 0, newId: fresh() });

    expect(done?.selection).toHaveLength(1);
    expect(done?.doc.tracks.flatMap((t) => t.clips).map((c) => c.id)).toEqual(done?.selection);
  });

  it('ungroups a group back into its elements', () => {
    const grouped = barAction(Action.Group, { doc: fixture(), selection: ['a', 'b'], frame: 0, newId: fresh() })!;
    const done = barAction(Action.Ungroup, { doc: grouped.doc, selection: grouped.selection, frame: 0, newId: fresh() });

    expect(done?.selection.sort()).toEqual(['a', 'b']);
  });

  it('frames the selection inside a new frame', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Square), square(0.3), 's1'));
    const done = barAction(Action.FrameSelection, { doc, selection: ['s1'], frame: 0, newId: fresh() });

    expect(findClip(done!.doc, 's1')?.clip.parent).toBe(done?.selection[0]);
  });

  it('adds auto layout around the selection, and a second run removes it', () => {
    const added = barAction(Action.AutoLayout, { doc: shapes(), selection: ['top', 'bottom'], frame: 0, newId: fresh() })!;
    const container = added.selection[0];

    expect(findClip(added.doc, container)?.clip.autoLayout).toBeTruthy();
    expect(findClip(barAction(Action.AutoLayout, { doc: added.doc, selection: [container], frame: 0, newId: fresh() })!.doc, container)?.clip.autoLayout).toBeFalsy();
  });

  it('unites two shapes into the bottom one', () => {
    const done = barAction(Action.Union, { doc: shapes(), selection: ['top', 'bottom'], frame: 0, newId: fresh() });

    expect(done?.selection).toEqual(['bottom']);
    expect(findClip(done!.doc, 'top')).toBeNull();
  });

  it('flips the selection', () => {
    const done = barAction(Action.FlipHorizontal, { doc: shapes(), selection: ['top'], frame: 0, newId: fresh() });

    expect(done?.doc).not.toEqual(shapes());
  });
});

const square = (x: number) => ({ component: 'Shape' as const, from: 0, durationInFrames: 30, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 } });

function shapes(): MotionDoc {
  const bottom = must(addClip(newMotionDoc(MotionFormat.Square), square(0.4), 'bottom'));
  return must(addClip(must(addTrack(bottom, TrackKind.Visual, 'upper')), { ...square(0.5), trackId: 'upper' }, 'top'));
}

describe('frameBarActions', () => {
  it('offers boolean ops only for two shapes or more', () => {
    expect(frameBarActions(shapes(), ['top', 'bottom'])).toContain(Action.Union);
    expect(frameBarActions(shapes(), ['top'])).not.toContain(Action.Union);
  });

  it('offers group for several and outline text only for text', () => {
    expect(frameBarActions(fixture(), ['a', 'b'])).toContain(Action.Group);
    expect(frameBarActions(fixture(), ['a'])).toContain(Action.TextToPath);
    expect(frameBarActions(shapes(), ['top'])).not.toContain(Action.TextToPath);
  });
});

describe('frameKeyAction', () => {
  const press = (key: string, mods: { meta?: boolean; shift?: boolean; alt?: boolean } = {}) =>
    ({ key, code: `Key${key.toUpperCase()}`, metaKey: !!mods.meta, ctrlKey: false, shiftKey: !!mods.shift, altKey: !!mods.alt }) as KeyboardEvent;

  it('maps the Figma structure keys to frame actions', () => {
    expect(frameKeyAction(press('g', { meta: true }))).toBe(Action.Group);
    expect(frameKeyAction(press('g', { meta: true, shift: true }))).toBe(Action.Ungroup);
    expect(frameKeyAction(press('g', { meta: true, alt: true }))).toBe(Action.FrameSelection);
    expect(frameKeyAction(press('a', { meta: true, alt: true }))).toBe(Action.SelectMatching);
    expect(frameKeyAction(press('a', { meta: true }))).toBe(Action.SelectAll);
    expect(frameKeyAction(press('e', { meta: true }))).toBe(Action.Flatten);
  });

  it('leaves every other key to the canvas', () => {
    expect(frameKeyAction(press('z', { meta: true }))).toBeNull();
  });
});

describe('picksFor', () => {
  it('select matching picks every shape like the picked one', () => {
    expect(picksFor(Action.SelectMatching, shapes(), ['top'])?.sort()).toEqual(['bottom', 'top']);
  });

  it('select all picks the siblings of the pick', () => {
    expect(picksFor(Action.SelectAll, fixture(), ['a'])?.sort()).toEqual(['a', 'b']);
  });

  it('is null for an action that edits', () => {
    expect(picksFor(Action.Group, fixture(), ['a'])).toBeNull();
  });
});

describe('FRAME_ELEMENT_MENU', () => {
  it('holds only what the canvas runs on elements', () => {
    expect(FRAME_ELEMENT_MENU.has('union')).toBe(true);
    expect(FRAME_ELEMENT_MENU.has('outline-text')).toBe(true);
    expect(FRAME_ELEMENT_MENU.has('delete')).toBe(true);
    expect(FRAME_ELEMENT_MENU.has('align-left')).toBe(false);
  });
});
