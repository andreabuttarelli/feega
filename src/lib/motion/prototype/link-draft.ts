import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { ActionKind, TransitionKind, TriggerKind, type Interaction, type InteractionInput } from '@feega/motion-core/motion/prototype/model';
import { interactionsOf, putInteraction } from './ops';

export type LinkDraft = { clipId: string; interactionId: string | null };

const FRAME_ACTIONS = new Set([ActionKind.Navigate, ActionKind.OpenOverlay]);

const fresh = (id: string, target: string): InteractionInput => ({ id, trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target }, transition: { kind: TransitionKind.Instant } });

function aimed(existing: Interaction, target: string): InteractionInput {
  const kind = FRAME_ACTIONS.has(existing.action.kind) ? existing.action.kind : ActionKind.Navigate;
  return { ...existing, action: { kind, target } as Interaction['action'] };
}

export function linkToFrame(doc: MotionDoc, draft: LinkDraft, target: string, newId: () => string): OpResult {
  const existing = interactionsOf(doc, draft.clipId).find((i) => i.id === draft.interactionId);
  return putInteraction(doc, draft.clipId, existing ? aimed(existing, target) : fresh(newId(), target));
}
