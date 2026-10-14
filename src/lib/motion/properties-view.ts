import { SECTION_ORDER, Section } from './inspector-sections';
import { ClipFamily } from './track-style';
import { EditMode } from './edit-mode';

export enum PropertiesView {
  Frame = 'frame',
  Clip = 'clip',
  Part = 'part',
  Multiple = 'multiple'
}

export function propertiesFor(selection: { count: number; clip: string | null; part: string | null }): PropertiesView {
  if (selection.count > 1) {
    return PropertiesView.Multiple;
  }
  if (selection.clip === null) {
    return PropertiesView.Frame;
  }
  return selection.part === null ? PropertiesView.Clip : PropertiesView.Part;
}

const ALL: readonly Section[] = SECTION_ORDER;
const VISUAL = [Section.Content, Section.Layout, Section.Layer, Section.Fill, Section.Effects, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];
const PICTURE = [Section.Content, Section.Layout, Section.Layer, Section.Effects, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];

const FAMILY_SECTIONS: Record<ClipFamily, readonly Section[]> = {
  [ClipFamily.Text]: [...VISUAL, Section.Text],
  [ClipFamily.Image]: PICTURE,
  [ClipFamily.Video]: PICTURE,
  [ClipFamily.Audio]: [Section.Content, Section.Timing, Section.Animate],
  [ClipFamily.Shape]: [...VISUAL, Section.Stroke, Section.Shape],
  [ClipFamily.ThreeD]: VISUAL,
  [ClipFamily.Custom]: ALL,
  [ClipFamily.Null]: [Section.Layout, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent],
  [ClipFamily.Camera]: [Section.Content, Section.Layout, Section.Timing, Section.Animate, Section.ThreeD],
  [ClipFamily.Mask]: VISUAL,
  [ClipFamily.Precomp]: VISUAL,
  [ClipFamily.Adjustment]: VISUAL
};

const PART_SECTIONS: ReadonlySet<Section> = new Set([Section.Content, Section.Layout, Section.Layer, Section.Fill, Section.Stroke, Section.Text]);

const MODE_HIDES: Record<EditMode, ReadonlySet<Section>> = {
  [EditMode.Motion]: new Set(),
  [EditMode.Design]: new Set([Section.Animate])
};

export function sectionsFor(family: ClipFamily, view: PropertiesView, mode: EditMode): Section[] {
  const allowed = new Set(FAMILY_SECTIONS[family]);
  return SECTION_ORDER.filter((s) => allowed.has(s) && !MODE_HIDES[mode].has(s) && (view !== PropertiesView.Part || PART_SECTIONS.has(s)));
}
