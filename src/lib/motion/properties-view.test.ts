import { describe, expect, it } from 'vitest';
import { PropertiesView, fieldShown, fieldShownFor, positionShown, propertiesFor, sectionsFor, ShapePart, shapePartShown, sizeShown, transformShown } from './properties-view';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { Placement } from '@feega/motion-core/motion/layout/stack';
import { Section } from './inspector-sections';
import { ClipFamily } from './track-style';
import { EditMode } from './edit-mode';

describe('what Properties shows for the selection', () => {
  it('the frame itself when nothing inside it is selected: format, length, frame rate, background, fields', () => {
    expect(propertiesFor({ count: 0, clip: null, part: null })).toBe(PropertiesView.Frame);
  });

  it('the clip when a clip is selected', () => {
    expect(propertiesFor({ count: 1, clip: 'c1', part: null })).toBe(PropertiesView.Clip);
  });

  it('only the part field when a poster part is selected', () => {
    expect(propertiesFor({ count: 1, clip: 'c1', part: 'lines:0' })).toBe(PropertiesView.Part);
  });

  it('the shared values, mixed where they differ, when several clips are selected', () => {
    expect(propertiesFor({ count: 3, clip: null, part: null })).toBe(PropertiesView.Multiple);
  });
});

describe('which sections each selection kind gets', () => {
  it('a shape gets the Stack section right under layout, above the shared fill, stroke and effects', () => {
    const sections = sectionsFor(ClipFamily.Shape, PropertiesView.Clip, EditMode.Design);
    expect(sections.indexOf(Section.Stack)).toBe(sections.indexOf(Section.Layout) + 1);
    expect(sections.indexOf(Section.Stack)).toBeLessThan(sections.indexOf(Section.Fill));
  });

  it('a poster part gets no Stack section; the frame itself gets one once it has auto layout', () => {
    expect(sectionsFor(ClipFamily.Shape, PropertiesView.Frame, EditMode.Design)).toContain(Section.Stack);
    expect(sectionsFor(ClipFamily.Text, PropertiesView.Part, EditMode.Design)).not.toContain(Section.Stack);
  });

  it('the frame itself: stack, layer (opacity, corners), fill, stroke and effects, never a shape kind', () => {
    expect(sectionsFor(ClipFamily.Shape, PropertiesView.Frame, EditMode.Design)).toEqual([Section.Stack, Section.Layer, Section.Fill, Section.Stroke, Section.Effects]);
  });


  it('a text layer: layout, layer, fill, stroke and text, never a path', () => {
    const sections = sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Motion);

    expect(sections).toEqual(expect.arrayContaining([Section.Layout, Section.Layer, Section.Fill, Section.Stroke, Section.Text]));
    expect(sections).not.toContain(Section.Shape);
  });

  it('a shape: fill, stroke and its path, no text', () => {
    const sections = sectionsFor(ClipFamily.Shape, PropertiesView.Clip, EditMode.Motion);

    expect(sections).toEqual(expect.arrayContaining([Section.Fill, Section.Stroke, Section.Shape]));
    expect(sections).not.toContain(Section.Text);
  });

  it('an image: fill and stroke like a rectangle, no text', () => {
    const sections = sectionsFor(ClipFamily.Image, PropertiesView.Clip, EditMode.Motion);

    expect(sections).toEqual(expect.arrayContaining([Section.Layout, Section.Layer, Section.Fill, Section.Stroke]));
    expect(sections).not.toContain(Section.Text);
  });

  it('a video keeps no fill or stroke', () => {
    const sections = sectionsFor(ClipFamily.Video, PropertiesView.Clip, EditMode.Motion);

    expect(sections).not.toContain(Section.Fill);
    expect(sections).not.toContain(Section.Stroke);
  });

  it('audio: no layout at all', () => {
    expect(sectionsFor(ClipFamily.Audio, PropertiesView.Clip, EditMode.Motion)).not.toContain(Section.Layout);
  });

  it('a poster part: only the fields that style that part, nothing about time', () => {
    const sections = sectionsFor(ClipFamily.Custom, PropertiesView.Part, EditMode.Motion);

    expect(sections).not.toContain(Section.Timing);
    expect(sections).not.toContain(Section.Animate);
    expect(sections).not.toContain(Section.Effects);
  });

  it('animation only in Motion mode', () => {
    expect(sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Motion)).toContain(Section.Animate);
    expect(sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Design)).not.toContain(Section.Animate);
  });

  it('keeps the one fixed order whatever the kind', () => {
    const sections = sectionsFor(ClipFamily.Shape, PropertiesView.Clip, EditMode.Motion);

    expect(sections.indexOf(Section.Layout)).toBeLessThan(sections.indexOf(Section.Fill));
    expect(sections.indexOf(Section.Fill)).toBeLessThan(sections.indexOf(Section.Stroke));
    expect(sections.indexOf(Section.Stroke)).toBeLessThan(sections.indexOf(Section.Effects));
  });

  it('a text reads alignment, layout, appearance, typography, then paint', () => {
    const sections = sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Design);
    const order = [Section.Align, Section.Layout, Section.Layer, Section.Text, Section.Fill, Section.Stroke, Section.Effects];

    expect(sections.filter((s) => order.includes(s))).toEqual(order);
  });
});

describe('a stack child in Properties', () => {
  it('drops frame alignment and constraints: the stack places it', () => {
    const sections = sectionsFor(ClipFamily.Shape, PropertiesView.Clip, EditMode.Design, Placement.Flow);
    expect(sections).not.toContain(Section.Align);
    expect(sections).not.toContain(Section.Constraints);
    expect(sections).toContain(Section.Stack);
  });

  it('hides X and Y unless it is absolute', () => {
    expect(positionShown(Placement.Free)).toBe(true);
    expect(positionShown(Placement.Flow)).toBe(false);
    expect(positionShown(Placement.Absolute)).toBe(true);
  });
});

describe('what a group shows', () => {
  it('places, aligns and layers it, with no fill, stroke or path of its own', () => {
    const sections = sectionsFor(ClipFamily.Group, PropertiesView.Clip, EditMode.Design);

    expect(sections).toEqual(expect.arrayContaining([Section.Align, Section.Layout, Section.Layer, Section.Effects]));
    expect(sections.filter((s) => [Section.Fill, Section.Stroke, Section.Shape, Section.Content].includes(s))).toEqual([]);
  });

  it('keeps only its box among the fields of the shape it is drawn with', () => {
    expect(['x', 'y', 'width', 'height', 'roundness', 'morphs', 'fills', 'clipContent'].filter((k) => fieldShownFor(ClipFamily.Group, k))).toEqual(['x', 'y', 'width', 'height']);
    expect(fieldShownFor(ClipFamily.Shape, 'roundness')).toBe(true);
  });
});

describe('Design mode keeps time and motion out of Properties', () => {
  const MOTION_ONLY = [Section.Timing, Section.Animate, Section.ThreeD, Section.Transform, Section.Parent];

  it.each([ClipFamily.Shape, ClipFamily.Text, ClipFamily.Image, ClipFamily.Precomp])('a %s in Design has no timing, animation, 3D, transform or parent', (family) => {
    const sections = sectionsFor(family, PropertiesView.Clip, EditMode.Design);
    expect(sections.filter((s) => MOTION_ONLY.includes(s))).toEqual([]);
  });

  it('the same layer in Motion gets them back', () => {
    expect(sectionsFor(ClipFamily.Shape, PropertiesView.Clip, EditMode.Motion)).toEqual(expect.arrayContaining(MOTION_ONLY));
  });

  it('a 3D model keeps its 3D section in Design: it is the model, not motion', () => {
    expect(sectionsFor(ClipFamily.ThreeD, PropertiesView.Clip, EditMode.Design)).toContain(Section.ThreeD);
  });
});

describe('which fields a layer shows', () => {
  const leaf = { mode: EditMode.Motion, shape: ShapeKind.Rect, morphTargets: 1, instance: false };

  it('morph only in Motion and only when the shape has targets to morph into', () => {
    expect(fieldShown('morph', leaf)).toBe(true);
    expect(fieldShown('morphStart', leaf)).toBe(true);
    expect(fieldShown('morph', { ...leaf, mode: EditMode.Design })).toBe(false);
    expect(fieldShown('morph', { ...leaf, morphTargets: 0 })).toBe(false);
  });

  it('fill rule only on a free path', () => {
    expect(fieldShown('fillRule', { ...leaf, shape: ShapeKind.Rect })).toBe(false);
    expect(fieldShown('fillRule', { ...leaf, shape: ShapeKind.Path })).toBe(true);
  });

  it('an instance swaps its main component in the instance panel, not in a Composition select', () => {
    expect(fieldShown('comp', { ...leaf, shape: null, instance: true })).toBe(false);
    expect(fieldShown('comp', { ...leaf, shape: null })).toBe(true);
  });

  it('any other field is always shown', () => {
    expect(fieldShown('roundness', { ...leaf, mode: EditMode.Design, morphTargets: 0 })).toBe(true);
  });

  it('layer blur lives in Effects, never a second blur in Appearance', () => {
    expect(transformShown('blur')).toBe(false);
    expect(transformShown('opacity')).toBe(true);
  });

  it('anchors are moved on the canvas, never typed', () => {
    expect(transformShown('anchorX')).toBe(false);
    expect(transformShown('anchorY')).toBe(false);
  });

  it('a stack child sizes in the Stack section only: no second W and H in Layout', () => {
    expect(sizeShown(Placement.Free)).toBe(true);
    expect(sizeShown(Placement.Flow)).toBe(false);
    expect(sizeShown(Placement.Absolute)).toBe(false);
  });
});

describe('the Path section by mode', () => {
  it('morph targets and liquid presets animate, so only Motion offers them', () => {
    expect(shapePartShown(ShapePart.Morph, EditMode.Design)).toBe(false);
    expect(shapePartShown(ShapePart.Liquid, EditMode.Design)).toBe(false);
    expect(shapePartShown(ShapePart.Morph, EditMode.Motion)).toBe(true);
  });

  it('converting to a path and modifiers stay in both', () => {
    expect(shapePartShown(ShapePart.Convert, EditMode.Design)).toBe(true);
    expect(shapePartShown(ShapePart.Modifiers, EditMode.Design)).toBe(true);
  });
});
