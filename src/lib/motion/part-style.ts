import { BlendMode } from './blend';
import { PropFormat } from './custom/component';
import { FillType, fillsSchema, type Fill } from './fill/model';
import { partFields, partFocus, partShared } from './inspector';
import { partUsage, sharedCount } from './part-usage';
import { PartEdit, editablePart, parsePart } from './poster-parts';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { setPartStyle, setProps, type OpResult } from './timeline';

const FALLBACK_COLOUR = '#000000';
const TEXT_COLOUR_SUFFIXES = ['Color', 'Colour', 'TextColor'];

export enum Colouring {
  Own = 'own',
  Shared = 'shared',
  None = 'none'
}

export type PartColour = { key: string | null; colouring: Colouring };

const colourKeys = (doc: MotionDoc, clip: MotionClip, keys: readonly string[]) => keys.filter((k) => doc.components[String(clip.props.name)]?.propsSchema.properties[k]?.format === PropFormat.Color);

const named = (keys: readonly string[], field: string) => keys.find((k) => TEXT_COLOUR_SUFFIXES.some((s) => k === field + s)) ?? keys[0] ?? null;

export function partColour(doc: MotionDoc, clip: MotionClip, part: string): PartColour {
  const { field } = parsePart(part);
  const { own, shared } = partFields(doc, clip, part);
  const mine = named(colourKeys(doc, clip, own), field);
  if (mine) {
    return { key: mine, colouring: Colouring.Own };
  }
  const common = named(colourKeys(doc, clip, shared), field);
  return { key: common, colouring: common ? Colouring.Shared : Colouring.None };
}

export const stylesPart = (doc: MotionDoc, clip: MotionClip, part: string): boolean => clip.component === 'Custom' && editablePart(doc, clip, part) === PartEdit.Text;

const valueOf = (doc: MotionDoc, clip: MotionClip, key: string | null): string => {
  if (!key) {
    return FALLBACK_COLOUR;
  }
  const fallback = doc.components[String(clip.props.name)]?.propsSchema.properties[key]?.default;
  return String(clip.props[key] ?? fallback ?? FALLBACK_COLOUR);
};

export function partFills(doc: MotionDoc, clip: MotionClip, part: string): Fill[] {
  const stored = clip.partStyles?.[part]?.fills;
  if (stored) {
    return stored;
  }
  return fillsSchema.parse([{ type: FillType.Solid, color: valueOf(doc, clip, partColour(doc, clip, part).key) }]);
}

const plainSolid = (fills: readonly Fill[]): string | null => {
  const [only] = fills;
  return fills.length === 1 && only.type === FillType.Solid && only.opacity === 1 && only.visible && only.blend === BlendMode.Normal ? only.color : null;
};

export function setPartFills(doc: MotionDoc, clipId: string, part: string, fills: Fill[]): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || !stylesPart(doc, clip, part)) {
    return { ok: false, error: `${part} is not a text part of ${clipId}` };
  }
  const { key, colouring } = partColour(doc, clip, part);
  const solid = plainSolid(fills);
  if (colouring !== Colouring.Own || !key || solid === null) {
    return setPartStyle(doc, clipId, part, { fills });
  }
  const cleared = setPartStyle(doc, clipId, part, null);
  return cleared.ok ? setProps(cleared.doc, clipId, { [key]: solid }) : cleared;
}

export type PartView = { focus: string[]; shared: string[]; sharedWith: number; fills: Fill[] | null };

export function partView(doc: MotionDoc, clip: MotionClip, part: string): PartView {
  const styled = stylesPart(doc, clip, part);
  const colour = styled ? partColour(doc, clip, part) : null;
  const focus = partFocus(doc, clip, part).filter((k) => colour?.colouring !== Colouring.Own || k !== colour.key);
  const shared = partShared(doc, clip, part);
  const usage = partUsage(String(clip.props.name));
  const sharedWith = usage ? Math.max(0, ...shared.map((k) => sharedCount(usage, k, part))) : 0;
  return { focus, shared, sharedWith, fills: styled ? partFills(doc, clip, part) : null };
}
