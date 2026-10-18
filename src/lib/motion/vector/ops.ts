import { findClip, type MotionDoc } from '../doc';
import { setProps, type OpResult } from '../timeline';
import { COMPONENTS } from '../components';
import { baseOutline, type ShapeLook } from '../shape/render';
import { ShapeKind } from '../shape/schema';
import { Winding, networkSchema, type VectorNetwork } from './model';
import { outlineToNetwork } from './outline';

const UNIT_BOX = { w: 1, h: 1 };

const WINDING: Record<string, Winding> = { nonzero: Winding.NonZero, evenodd: Winding.EvenOdd };

function shapeLook(doc: MotionDoc, clipId: string): ShapeLook | string {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return `no clip ${clipId}`;
  }
  if (clip.component !== 'Shape') {
    return `${clipId} is a ${clip.component}, not a Shape`;
  }
  return COMPONENTS.Shape.schema.parse(clip.props) as unknown as ShapeLook;
}

export function toVector(doc: MotionDoc, clipId: string): OpResult {
  const look = shapeLook(doc, clipId);
  if (typeof look === 'string') {
    return { ok: false, error: look };
  }
  const network = outlineToNetwork(baseOutline(look, UNIT_BOX), WINDING[look.fillRule] ?? Winding.NonZero);
  return setProps(doc, clipId, { shape: ShapeKind.Vector, network, morphs: [] });
}

export function setNetwork(doc: MotionDoc, clipId: string, network: VectorNetwork): OpResult {
  const look = shapeLook(doc, clipId);
  if (typeof look === 'string') {
    return { ok: false, error: look };
  }
  const parsed = networkSchema.safeParse(network);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  return setProps(doc, clipId, { shape: ShapeKind.Vector, network: parsed.data });
}
