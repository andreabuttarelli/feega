import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { ElementState, STATE_LABEL } from '@feega/motion-core/motion/states/model';
import { setVariant } from '$lib/motion/variants';

const STATE_PROPERTY = 'State';
const HALFWAY = 0.5;

export function inVariantState(doc: MotionDoc, clipId: string, state: ElementState): MotionDoc | null {
  const swapped = setVariant(doc, clipId, { [STATE_PROPERTY]: STATE_LABEL[state] });
  return swapped.ok ? swapped.doc : null;
}

export const hasVariantStates = (doc: MotionDoc, clipId: string): boolean => inVariantState(doc, clipId, ElementState.Hover) !== null;

export const pastHalfway = (amount: number): boolean => amount >= HALFWAY;
