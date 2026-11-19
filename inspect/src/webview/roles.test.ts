import { describe, expect, it } from 'vitest';
import { Section } from './controls';
import { Role, roleOf, sectionsOf } from './roles';

const element = (tag: string, ownText: boolean, elements: number, display = 'block') => ({ tag, ownText, elements, display });

describe('roleOf', () => {
  it('a section with element children is a container', () => {
    expect(roleOf(element('section', false, 3))).toBe(Role.Container);
  });

  it('a div with only its own text is text', () => {
    expect(roleOf(element('div', true, 0))).toBe(Role.Text);
  });

  it('an empty heading is still text', () => {
    expect(roleOf(element('h1', false, 0))).toBe(Role.Text);
  });

  it('a heading wrapping spans is a container of text', () => {
    expect(roleOf(element('h1', false, 2))).toBe(Role.Container);
  });

  it('img, svg and video are media', () => {
    expect(['img', 'svg', 'video'].map((tag) => roleOf(element(tag, false, 0)))).toEqual([Role.Media, Role.Media, Role.Media]);
  });

  it('inputs are inputs', () => {
    expect(roleOf(element('input', false, 0, 'inline-block'))).toBe(Role.Input);
  });

  it('a flex box with text is still laid out as a container', () => {
    expect(roleOf(element('a', true, 1, 'flex'))).toBe(Role.Container);
  });
});

describe('sectionsOf', () => {
  it('a container has no typography', () => {
    expect(sectionsOf(Role.Container)).not.toContain(Section.Typography);
    expect(sectionsOf(Role.Container)).toContain(Section.Layout);
  });

  it('text has typography and no auto layout', () => {
    expect(sectionsOf(Role.Text)).toContain(Section.Typography);
    expect(sectionsOf(Role.Text)).not.toContain(Section.Layout);
  });

  it('media has only size, radius and effects', () => {
    expect(sectionsOf(Role.Media)).toEqual([Section.Size, Section.Radius, Section.Effects]);
  });
});
