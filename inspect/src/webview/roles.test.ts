import { describe, expect, it } from 'vitest';
import { Section } from './controls';
import { Role, actionsOf, roleOf, sectionsOf } from './roles';

const element = (tag: string, ownText: boolean, elements: number, display = 'block', inlineText = false) => ({ tag, ownText, elements, display, inlineText });

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

  it('a heading wrapping spans is text, by its tag', () => {
    expect(roleOf(element('h1', false, 2))).toBe(Role.Text);
  });

  it('a div holding only inline text elements is text', () => {
    expect(roleOf(element('div', false, 2, 'block', true))).toBe(Role.Text);
  });

  it('a div with block children is a container', () => {
    expect(roleOf(element('div', false, 2))).toBe(Role.Container);
  });

  it('img and video are media, svg is an icon', () => {
    expect(['img', 'svg', 'video'].map((tag) => roleOf(element(tag, false, 0)))).toEqual([Role.Media, Role.Icon, Role.Media]);
  });

  it('inputs are inputs', () => {
    expect(roleOf(element('input', false, 0, 'inline-block'))).toBe(Role.Input);
  });

  it('a flex box with text is still laid out as a container', () => {
    expect(roleOf(element('a', true, 1, 'flex'))).toBe(Role.Container);
  });
});

describe('head elements', () => {
  it('title, meta, link and script are head, with no visual sections', () => {
    for (const tag of ['title', 'meta', 'link', 'script', 'style', 'base', 'head']) {
      expect(roleOf(element(tag, false, 0))).toBe(Role.Head);
    }
    expect(sectionsOf(Role.Head)).toEqual([]);
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

  it('media has object fit and no typography', () => {
    expect(sectionsOf(Role.Media)).toContain(Section.Object);
    expect(sectionsOf(Role.Media)).not.toContain(Section.Typography);
  });

  it('only media fits an object, only text has text options', () => {
    expect(sectionsOf(Role.Container)).not.toContain(Section.Object);
    expect(sectionsOf(Role.Container)).toContain(Section.Grid);
    expect(sectionsOf(Role.Text)).toContain(Section.TextOptions);
  });

  it('an icon has the icon section and no typography', () => {
    expect(sectionsOf(Role.Icon)).toContain(Section.Icon);
    expect(sectionsOf(Role.Icon)).not.toContain(Section.Typography);
  });
});

describe('layer actions by role', () => {
  it('head elements and the page have no show/hide or lock', () => {
    expect([Role.Head, Role.Page].map((r) => actionsOf(r))).toEqual([{ visibility: false, lock: false }, { visibility: false, lock: false }]);
  });

  it('visual roles can be hidden and locked', () => {
    expect([Role.Text, Role.Container, Role.Media, Role.Icon, Role.Input].every((r) => actionsOf(r).visibility && actionsOf(r).lock)).toBe(true);
  });

  it('html and body are the page, title is head', () => {
    expect(['html', 'body', 'title'].map((tag) => roleOf(element(tag, false, 2)))).toEqual([Role.Page, Role.Page, Role.Head]);
  });

  it('the page keeps the container sections and head has none', () => {
    expect(sectionsOf(Role.Page)).toEqual(sectionsOf(Role.Container));
    expect(sectionsOf(Role.Head)).toEqual([]);
  });
});
