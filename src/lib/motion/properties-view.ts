import { SECTION_ORDER, Section } from './inspector-sections';
import { ClipFamily } from './track-style';
import { EditMode } from './edit-mode';
import { Placement } from '@feega/motion-core/motion/layout/stack';

export enum PropertiesView {
  Frame = 'frame',
  Clip = 'clip',
  Part = 'part',
  Multiple = 'multiple',
  Template = 'template'
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
const PLACED = [Section.Layout, Section.Stack, Section.Align, Section.Constraints, Section.Transform];
const VISUAL = [Section.Content, ...PLACED, Section.Layer, Section.Fill, Section.Effects, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];
const PICTURE = [Section.Content, ...PLACED, Section.Layer, Section.Effects, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];

const FAMILY_SECTIONS: Record<ClipFamily, readonly Section[]> = {
  [ClipFamily.Text]: [...VISUAL, Section.Stroke, Section.Text],
  [ClipFamily.Image]: PICTURE,
  [ClipFamily.Video]: PICTURE,
  [ClipFamily.Audio]: [Section.Content, Section.Timing, Section.Animate],
  [ClipFamily.Shape]: [...VISUAL, Section.Stroke, Section.Shape],
  [ClipFamily.ThreeD]: VISUAL,
  [ClipFamily.Custom]: ALL,
  [ClipFamily.Null]: [...PLACED, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent],
  [ClipFamily.Camera]: [Section.Content, Section.Layout, Section.Transform, Section.Timing, Section.Animate, Section.ThreeD],
  [ClipFamily.Mask]: VISUAL,
  [ClipFamily.Precomp]: VISUAL,
  [ClipFamily.Adjustment]: VISUAL
};

const PART_SECTIONS: ReadonlySet<Section> = new Set([Section.Content, Section.Layout, Section.Transform, Section.Layer, Section.Fill, Section.Stroke, Section.Text]);
const FRAME_SECTIONS: ReadonlySet<Section> = new Set([Section.Layer, Section.Fill, Section.Stroke, Section.Effects]);

const VIEW_KEEPS: Partial<Record<PropertiesView, ReadonlySet<Section>>> = { [PropertiesView.Part]: PART_SECTIONS, [PropertiesView.Frame]: FRAME_SECTIONS };

const MODE_HIDES: Record<EditMode, ReadonlySet<Section>> = {
  [EditMode.Motion]: new Set(),
  [EditMode.Design]: new Set([Section.Animate])
};

const PLACEMENT: Record<Placement, { hides: ReadonlySet<Section>; position: boolean }> = {
  [Placement.Free]: { hides: new Set(), position: true },
  [Placement.Flow]: { hides: new Set([Section.Align, Section.Constraints]), position: false },
  [Placement.Absolute]: { hides: new Set([Section.Constraints]), position: true }
};

export const positionShown = (placement: Placement): boolean => PLACEMENT[placement].position;

export function sectionsFor(family: ClipFamily, view: PropertiesView, mode: EditMode, placement: Placement = Placement.Free): Section[] {
  const allowed = new Set(FAMILY_SECTIONS[family]);
  const hidden = (s: Section) => MODE_HIDES[mode].has(s) || PLACEMENT[placement].hides.has(s);
  return SECTION_ORDER.filter((s) => allowed.has(s) && !hidden(s) && (VIEW_KEEPS[view]?.has(s) ?? true));
}
