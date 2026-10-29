import { BarContext } from './bottom-bar';

export enum InsertSection {
  Tools = 'tools',
  Generate = 'generate',
  Models = 'models',
  Import = 'import',
  Templates = 'templates',
  Frame = 'frame'
}

export const INSERT_SECTION_TITLE: Record<InsertSection, string> = {
  [InsertSection.Tools]: 'Tools',
  [InsertSection.Generate]: 'Generate',
  [InsertSection.Models]: 'Models',
  [InsertSection.Import]: 'Import',
  [InsertSection.Templates]: 'Templates',
  [InsertSection.Frame]: 'Frame'
};

const CANVAS_SECTIONS: readonly InsertSection[] = [InsertSection.Tools, InsertSection.Generate, InsertSection.Models, InsertSection.Import, InsertSection.Templates];

const SECTIONS: Record<BarContext, readonly InsertSection[]> = {
  [BarContext.Canvas]: CANVAS_SECTIONS,
  [BarContext.Frame]: [...CANVAS_SECTIONS, InsertSection.Frame]
};

export const insertSections = (context: BarContext): readonly InsertSection[] => SECTIONS[context];
