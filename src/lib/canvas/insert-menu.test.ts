import { describe, expect, it } from 'vitest';
import { BarContext } from './bottom-bar';
import { InsertSection, insertMenuMaxHeight, insertSections } from './insert-menu';

describe('the + insert menu', () => {
  it('on the canvas offers tools, generate nodes, hot models, import and templates, in that order', () => {
    expect(insertSections(BarContext.Canvas)).toEqual([InsertSection.Tools, InsertSection.Generate, InsertSection.Models, InsertSection.Import, InsertSection.Templates]);
  });

  it('a selected frame adds its own section at the end', () => {
    expect(insertSections(BarContext.Frame)).toEqual([...insertSections(BarContext.Canvas), InsertSection.Frame]);
  });
});

describe('the insert menu height', () => {
  it('never reaches above the top of the screen, however high the bar is lifted', () => {
    expect(insertMenuMaxHeight(300)).toBe(278);
    expect(insertMenuMaxHeight(300, 40)).toBe(238);
  });

  it('is capped on tall windows and keeps a floor on tiny ones', () => {
    expect(insertMenuMaxHeight(2000)).toBe(560);
    expect(insertMenuMaxHeight(50)).toBe(120);
  });
});
