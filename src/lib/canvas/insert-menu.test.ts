import { describe, expect, it } from 'vitest';
import { BarContext } from './bottom-bar';
import { InsertSection, insertSections } from './insert-menu';

describe('the + insert menu', () => {
  it('on the canvas offers tools, generate nodes, import and templates, in that order', () => {
    expect(insertSections(BarContext.Canvas)).toEqual([InsertSection.Tools, InsertSection.Generate, InsertSection.Import, InsertSection.Templates]);
  });

  it('a selected frame adds its own section at the end', () => {
    expect(insertSections(BarContext.Frame)).toEqual([...insertSections(BarContext.Canvas), InsertSection.Frame]);
  });
});
