import { describe, expect, it } from 'vitest';
import { ClipFamily } from './track-style';
import { Part, SECTION_ORDER, Section, fieldLook, sectionSummary, flipSection, isOpen, readSections, shows, transformSection } from './inspector-sections';
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

  it('opens only the first section by default, so a clip shows a short list of summaries', () => {
    expect(isOpen({}, ClipFamily.Text, Section.Content)).toBe(true);
    expect(isOpen({}, ClipFamily.Text, Section.Style)).toBe(false);
    expect(isOpen({}, ClipFamily.Text, Section.Layout)).toBe(false);
    expect(isOpen({}, ClipFamily.Text, Section.Timing)).toBe(false);
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
