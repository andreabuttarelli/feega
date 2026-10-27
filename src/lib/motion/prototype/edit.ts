import { ActionKind, DEFAULT_DELAY_MS, TransitionKind, TriggerKind, transitionSchema, type Interaction } from '@feega/motion-core/motion/prototype/model';

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

export function retargeted(interaction: Interaction, kind: ActionKind, target: string): Interaction {
  const action = kind === ActionKind.Back ? { kind } : { kind, target };
  return { ...interaction, action } as Interaction;
}

export function retimed(interaction: Interaction, patch: Record<string, unknown>): Interaction {
  return { ...interaction, transition: transitionSchema.parse({ ...interaction.transition, ...patch }) };
}
