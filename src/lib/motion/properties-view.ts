import { SECTION_ORDER, Section } from './inspector-sections';
import { ClipFamily } from './track-style';
import { EditMode } from './edit-mode';
import { Placement } from '@feega/motion-core/motion/layout/stack';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';

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
const VISUAL = [Section.Content, ...PLACED, Section.Layer, Section.Fill, Section.Effects, Section.Colours, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];
const PICTURE = [Section.Content, ...PLACED, Section.Layer, Section.Effects, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];
const DRESSED_PICTURE = [...PICTURE, Section.Fill, Section.Stroke];

const FAMILY_SECTIONS: Record<ClipFamily, readonly Section[]> = {
  [ClipFamily.Text]: [...VISUAL, Section.Stroke, Section.Text],
  [ClipFamily.Image]: DRESSED_PICTURE,
  [ClipFamily.Video]: PICTURE,
  [ClipFamily.Audio]: [Section.Content, Section.Timing, Section.Animate],
  [ClipFamily.Shape]: [...VISUAL, Section.Stroke, Section.Shape],
  [ClipFamily.ThreeD]: VISUAL,
  [ClipFamily.Custom]: ALL,
  [ClipFamily.Null]: [...PLACED, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent],
  [ClipFamily.Camera]: [Section.Content, Section.Layout, Section.Transform, Section.Timing, Section.Animate, Section.ThreeD],
  [ClipFamily.Mask]: VISUAL,
  [ClipFamily.Precomp]: VISUAL,
  [ClipFamily.Adjustment]: VISUAL,
  [ClipFamily.Group]: [...PLACED, Section.Layer, Section.Effects, Section.Timing, Section.Animate, Section.Parent]
};

const TEXT_ORDER: readonly Section[] = [Section.Align, Section.Layout, Section.Stack, Section.Constraints, Section.Content, Section.Layer, Section.Text, Section.Fill, Section.Stroke, Section.Effects, Section.Transform, Section.Timing, Section.Animate, Section.ThreeD, Section.Parent];

const FAMILY_ORDER: Partial<Record<ClipFamily, readonly Section[]>> = { [ClipFamily.Text]: TEXT_ORDER };

const PART_SECTIONS: ReadonlySet<Section> = new Set([Section.Content, Section.Layout, Section.Transform, Section.Layer, Section.Fill, Section.Stroke, Section.Text]);
const FRAME_SECTIONS: ReadonlySet<Section> = new Set([Section.Layer, Section.Fill, Section.Stroke, Section.Effects]);

const VIEW_KEEPS: Partial<Record<PropertiesView, ReadonlySet<Section>>> = { [PropertiesView.Part]: PART_SECTIONS, [PropertiesView.Frame]: FRAME_SECTIONS };

const MODE_HIDES: Record<EditMode, ReadonlySet<Section>> = {
  [EditMode.Motion]: new Set(),
  [EditMode.Design]: new Set([Section.Animate, Section.Timing, Section.ThreeD, Section.Transform, Section.Parent])
};

const FAMILY_KEEPS: Partial<Record<ClipFamily, ReadonlySet<Section>>> = {
  [ClipFamily.ThreeD]: new Set([Section.ThreeD]),
  [ClipFamily.Camera]: new Set([Section.ThreeD])
};

const PLACEMENT: Record<Placement, { hides: ReadonlySet<Section>; position: boolean; size: boolean }> = {
  [Placement.Free]: { hides: new Set(), position: true, size: true },
  [Placement.Flow]: { hides: new Set([Section.Align, Section.Constraints]), position: false, size: false },
  [Placement.Absolute]: { hides: new Set([Section.Constraints]), position: true, size: false }
};

const FAMILY_FIELDS: Partial<Record<ClipFamily, ReadonlySet<string>>> = { [ClipFamily.Group]: new Set(['x', 'y', 'width', 'height']) };

export const fieldShownFor = (family: ClipFamily, key: string): boolean => FAMILY_FIELDS[family]?.has(key) ?? true;

export const positionShown = (placement: Placement): boolean => PLACEMENT[placement].position;

export const sizeShown = (placement: Placement): boolean => PLACEMENT[placement].size;

export type FieldContext = { mode: EditMode; shape: ShapeKind | null; morphTargets: number };

const morphing = (c: FieldContext) => c.mode === EditMode.Motion && c.morphTargets > 0;

const FIELD_SHOWN: Record<string, (c: FieldContext) => boolean> = {
  morph: morphing,
  morphStart: morphing,
  fillRule: (c) => c.shape === ShapeKind.Path
};

export const fieldShown = (key: string, context: FieldContext): boolean => FIELD_SHOWN[key]?.(context) ?? true;

const TRANSFORM_HIDDEN: ReadonlySet<string> = new Set(['anchorX', 'anchorY', 'blur']);

export enum ShapePart {
  Convert = 'convert',
  Morph = 'morph',
  Liquid = 'liquid',
  Modifiers = 'modifiers'
}

const SHAPE_PARTS: Record<EditMode, ReadonlySet<ShapePart>> = {
  [EditMode.Motion]: new Set(Object.values(ShapePart)),
  [EditMode.Design]: new Set([ShapePart.Convert, ShapePart.Modifiers])
};

export const shapePartShown = (part: ShapePart, mode: EditMode): boolean => SHAPE_PARTS[mode].has(part);

export const transformShown = (key: string): boolean => !TRANSFORM_HIDDEN.has(key);

export function sectionsFor(family: ClipFamily, view: PropertiesView, mode: EditMode, placement: Placement = Placement.Free): Section[] {
  const allowed = new Set(FAMILY_SECTIONS[family]);
  const hidden = (s: Section) => (MODE_HIDES[mode].has(s) && !FAMILY_KEEPS[family]?.has(s)) || PLACEMENT[placement].hides.has(s);
  return (FAMILY_ORDER[family] ?? SECTION_ORDER).filter((s) => allowed.has(s) && !hidden(s) && (VIEW_KEEPS[view]?.has(s) ?? true));
}
