import type { MotionDoc } from '../doc';
import { restretched, withContentHeight, withFittedInstances } from '../layout/resolve';
import { withHiddenSubtrees } from '../organize';
import { carryChanges, liftEdit, resolveAt } from './model';

export const resolveView = (doc: MotionDoc, breakpointId: string): MotionDoc => withContentHeight(withFittedInstances(withHiddenSubtrees(resolveAt(doc, breakpointId))));

export function liftViewEdit(source: MotionDoc, breakpointId: string, before: MotionDoc, after: MotionDoc): MotionDoc {
  const resolved = resolveAt(source, breakpointId);
  const edited = carryChanges(resolved, restretched(before, resolved.height), restretched(after, resolved.height));
  return liftEdit(source, breakpointId, edited);
}
