import { describe, expect, it } from 'vitest';
import { ClipFamily } from './track-style';
import { Part, SECTION_ORDER, Section, fieldLook, flipSection, isOpen, readSections, shows, transformSection } from './inspector-sections';
import { FieldFill } from './number-field';
import { Source } from './keyframes';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

describe('inspector sections', () => {
  it('puts what you edit most first, the same for every family', () => {
    expect(SECTION_ORDER.slice(0, 4)).toEqual([Section.Content, Section.Style, Section.Layout, Section.Timing]);
    expect(SECTION_ORDER.indexOf(Section.ThreeD)).toBeGreaterThan(SECTION_ORDER.indexOf(Section.Effects));
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

  it('sends 2D transform to Layout and depth and tilt to 3D', () => {
    expect(transformSection('x')).toBe(Section.Layout);
    expect(transformSection('opacity')).toBe(Section.Layout);
    expect(transformSection('rotateX')).toBe(Section.ThreeD);
    expect(transformSection('z')).toBe(Section.ThreeD);
  });

  it('gives each value a short scrub glyph, a unit, and a fill only where the range means something', () => {
    expect(fieldLook('rotateZ')).toEqual({ glyph: '↻', unit: '°', fill: FieldFill.None });
    expect(fieldLook('opacity').fill).toBe(FieldFill.Range);
    expect(fieldLook('lineHeight').glyph).toBeNull();
    expect(fieldLook('x', Source.Transform).glyph).toBe('ΔX');
    expect(fieldLook('x').glyph).toBe('X');
  });
});
