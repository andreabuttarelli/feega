import { ActionKind, DEFAULT_DELAY_MS, TransitionKind, TriggerKind, transitionSchema, type Action, type Interaction } from '@feega/motion-core/motion/prototype/model';

export const TRANSITION_FIELDS: Record<TransitionKind, { direction: boolean; timing: boolean }> = {
  [TransitionKind.Instant]: { direction: false, timing: false },
  [TransitionKind.Dissolve]: { direction: false, timing: true },
  [TransitionKind.Slide]: { direction: true, timing: true },
  [TransitionKind.Push]: { direction: true, timing: true },
  [TransitionKind.SmartAnimate]: { direction: false, timing: true }
};

export function retriggered(interaction: Interaction, kind: TriggerKind): Interaction {
  const trigger = kind === TriggerKind.AfterDelay ? { kind, delayMs: DEFAULT_DELAY_MS } : { kind };
  return { ...interaction, trigger };
}

type Picked = Record<string, string>;

const ACTION_OF: Record<ActionKind, (target: string, variant: Picked) => Action> = {
  [ActionKind.Navigate]: (target) => ({ kind: ActionKind.Navigate, target }),
  [ActionKind.OpenOverlay]: (target) => ({ kind: ActionKind.OpenOverlay, target }),
  [ActionKind.ScrollTo]: (target) => ({ kind: ActionKind.ScrollTo, target }),
  [ActionKind.Back]: () => ({ kind: ActionKind.Back }),
  [ActionKind.ChangeTo]: (_target, variant) => ({ kind: ActionKind.ChangeTo, variant })
};

export function retargeted(interaction: Interaction, kind: ActionKind, target: string, variant: Picked = {}): Interaction {
  return { ...interaction, action: ACTION_OF[kind](target, variant) };
}

export function retimed(interaction: Interaction, patch: Record<string, unknown>): Interaction {
  return { ...interaction, transition: transitionSchema.parse({ ...interaction.transition, ...patch }) };
}
