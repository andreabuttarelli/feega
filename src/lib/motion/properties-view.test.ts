import { describe, expect, it } from 'vitest';
import { PropertiesView, propertiesFor, sectionsFor } from './properties-view';
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

  it('the frame itself and a poster part get no Stack section', () => {
    expect(sectionsFor(ClipFamily.Shape, PropertiesView.Frame, EditMode.Design)).not.toContain(Section.Stack);
    expect(sectionsFor(ClipFamily.Text, PropertiesView.Part, EditMode.Design)).not.toContain(Section.Stack);
  });

  it('the frame itself: layer (opacity, corners), fill, stroke and effects, never a shape kind', () => {
    expect(sectionsFor(ClipFamily.Shape, PropertiesView.Frame, EditMode.Design)).toEqual([Section.Layer, Section.Fill, Section.Stroke, Section.Effects]);
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

  it('an image: no fill, stroke or text', () => {
    const sections = sectionsFor(ClipFamily.Image, PropertiesView.Clip, EditMode.Motion);

    expect(sections).toContain(Section.Layout);
    expect(sections).not.toContain(Section.Fill);
    expect(sections).not.toContain(Section.Text);
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
    expect(sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Motion).indexOf(Section.Effects)).toBeLessThan(sectionsFor(ClipFamily.Text, PropertiesView.Clip, EditMode.Motion).indexOf(Section.Text));
  });
});
