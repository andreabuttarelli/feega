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

const MENU_EDGE_MARGIN_PX = 12;
const MENU_GAP_PX = 10;
const MENU_MAX_PX = 560;
const MENU_MIN_PX = 120;

export const insertMenuMaxHeight = (barTop: number, topInset = 0): number =>
  Math.min(MENU_MAX_PX, Math.max(MENU_MIN_PX, barTop - topInset - MENU_GAP_PX - MENU_EDGE_MARGIN_PX));
