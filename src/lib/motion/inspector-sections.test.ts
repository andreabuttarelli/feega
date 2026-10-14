import { describe, expect, it } from 'vitest';
import { ClipFamily } from './track-style';
import { Part, SECTION_ORDER, uiHidden, Section, Typed, fieldLook, fieldSection, sectionSummary, flipSection, isOpen, readSections, shadowed, shows, transformSection } from './inspector-sections';
import { Control, Group } from './components';
import { FieldFill } from './number-field';
import { Source } from './keyframes';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

describe('inspector sections', () => {
  it('keeps one predictable order: layout, layer, fill, stroke, effects, text, animation', () => {
    const order = [Section.Layout, Section.Layer, Section.Fill, Section.Stroke, Section.Effects, Section.Text, Section.Animate];
    expect(SECTION_ORDER.filter((s) => order.includes(s))).toEqual(order);
    expect(SECTION_ORDER[0]).toBe(Section.Content);
    expect(SECTION_ORDER.indexOf(Section.Animate)).toBeGreaterThan(SECTION_ORDER.indexOf(Section.Effects));
    expect(SECTION_ORDER.indexOf(Section.ThreeD)).toBeGreaterThan(SECTION_ORDER.indexOf(Section.Effects));
  });

  it('opens what a designer edits by default and folds the rarely used', () => {
    expect(isOpen({}, ClipFamily.Text, Section.Content)).toBe(true);
    expect(isOpen({}, ClipFamily.Text, Section.Layout)).toBe(true);
    expect(isOpen({}, ClipFamily.Text, Section.Text)).toBe(true);
    expect(isOpen({}, ClipFamily.Shape, Section.Effects)).toBe(true);
    expect(isOpen({}, ClipFamily.Text, Section.Timing)).toBe(false);
    expect(isOpen({}, ClipFamily.Text, Section.Animate)).toBe(false);
  });

  it('sums a closed section up in one line', () => {
    const clip = { from: 30, durationInFrames: 60, transform: { scale: 1.5, rotateZ: 10 }, keyframes: { opacity: [], x: [{ frame: 0, value: 0, ease: 'linear' as const }] }, effects: [], blend: 'normal', parent: null, mask: null, component: 'Title' as const, props: { text: 'Hello\nworld' } };

    expect(sectionSummary(Section.Layout, clip, 30)).toBe('Scale 150% · Rotate 10°');
    expect(sectionSummary(Section.Timing, clip, 30)).toBe('At 1s · 2s long');
    expect(sectionSummary(Section.Animate, clip, 30)).toBe('1 animated');
    expect(sectionSummary(Section.Content, clip, 30)).toBe('Hello');
    expect(sectionSummary(Section.Parent, clip, 30)).toBe('');
  });

  it('opens 3D only on 3D layers', () => {
    expect(isOpen({}, ClipFamily.Text, Section.ThreeD)).toBe(false);
    expect(isOpen({}, ClipFamily.ThreeD, Section.ThreeD)).toBe(true);
    expect(isOpen({}, ClipFamily.Text, Section.Content)).toBe(true);
  });

  it('remembers a toggled section per family', () => {
    const store = memory();
    const state = flipSection({}, ClipFamily.Text, Section.Content, store);

    expect(isOpen(state, ClipFamily.Text, Section.Content)).toBe(false);
    expect(isOpen(state, ClipFamily.Shape, Section.Content)).toBe(true);
    expect(readSections(store)).toEqual(state);
  });

  it('shows ducking only on audio, and transitions on everything but audio', () => {
    expect(shows(Part.Ducking, ClipFamily.Audio)).toBe(true);
    expect(shows(Part.Ducking, ClipFamily.Text)).toBe(false);
    expect(shows(Part.Transitions, ClipFamily.Audio)).toBe(false);
    expect(shows(Part.Transitions, ClipFamily.Text)).toBe(true);
  });

  it('sends 2D transform to Layout, opacity and blur to Layer, depth and tilt to 3D', () => {
    expect(transformSection('x')).toBe(Section.Layout);
    expect(transformSection('opacity')).toBe(Section.Layer);
    expect(transformSection('blur')).toBe(Section.Layer);
    expect(transformSection('rotateX')).toBe(Section.ThreeD);
    expect(transformSection('z')).toBe(Section.ThreeD);
  });

  it('labels each value in English with its unit, and fills only where the range means something', () => {
    expect(fieldLook('rotateZ')).toEqual({ short: 'Rotate', unit: '°', fill: FieldFill.None });
    expect(fieldLook('tracking')).toMatchObject({ short: 'Spacing', unit: 'em' });
    expect(fieldLook('leading')).toMatchObject({ short: 'Line', unit: '×' });
    expect(fieldLook('opacity').fill).toBe(FieldFill.Range);
    expect(fieldLook('lineHeight').short).toBeNull();
    expect(fieldLook('x', Source.Transform).short).toBe('Offset X');
    expect(fieldLook('x').short).toBe('X');
  });

  it('files every field under the section a designer looks for it in', () => {
    const field = (key: string, control: Control, group: Group) => ({ key, control, group });

    expect(fieldSection(field('size', Control.Range, Group.Style), Typed.Yes)).toBe(Section.Text);
    expect(fieldSection(field('align', Control.Select, Group.Layout), Typed.Yes)).toBe(Section.Text);
    expect(fieldSection(field('align', Control.Select, Group.Layout), Typed.No)).toBe(Section.Layout);
    expect(fieldSection(field('color', Control.Color, Group.Style), Typed.Yes)).toBe(Section.Fill);
    expect(fieldSection(field('paper', Control.Color, Group.Style), Typed.No)).toBe(Section.Fill);
    expect(fieldSection(field('strokeWidth', Control.Range, Group.Style), Typed.No)).toBe(Section.Stroke);
    expect(fieldSection(field('corners', Control.Corners, Group.Content), Typed.No)).toBe(Section.Layer);
    expect(fieldSection(field('fit', Control.Select, Group.Style), Typed.No)).toBe(Section.Content);
    expect(fieldSection(field('move', Control.Select, Group.Motion), Typed.No)).toBe(Section.Animate);
  });

  it('hides a box value the transform already shows, unless it was changed', () => {
    const transform = new Set(['opacity', 'scale', 'rotateZ']);

    expect(shadowed('opacity', 1, 1, transform)).toBe(true);
    expect(shadowed('opacity', 0.5, 1, transform)).toBe(false);
    expect(shadowed('opacity', 1, 1, new Set())).toBe(false);
    expect(shadowed('width', 0.8, 0.8, transform)).toBe(false);
  });

  it('never shows a field that only wires the runtime, like the variable prefix', () => {
    expect(uiHidden('varPrefix')).toBe(true);
    expect(uiHidden('ink')).toBe(false);
  });
});
