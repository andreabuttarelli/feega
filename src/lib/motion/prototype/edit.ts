import { ActionKind, DEFAULT_DELAY_MS, DEFAULT_OVERLAY, TransitionKind, TriggerKind, overlaySchema, transitionSchema, type Action, type Interaction, type Overlay } from '@feega/motion-core/motion/prototype/model';

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

const overlayOf = (action: Action): Overlay => (action.kind === ActionKind.OpenOverlay ? action.overlay : DEFAULT_OVERLAY);

const ACTION_OF: Record<ActionKind, (target: string, variant: Picked, was: Action) => Action> = {
  [ActionKind.Navigate]: (target) => ({ kind: ActionKind.Navigate, target }),
  [ActionKind.OpenOverlay]: (target, _variant, was) => ({ kind: ActionKind.OpenOverlay, target, overlay: overlayOf(was) }),
  [ActionKind.CloseOverlay]: () => ({ kind: ActionKind.CloseOverlay }),
  [ActionKind.ScrollTo]: (target) => ({ kind: ActionKind.ScrollTo, target }),
  [ActionKind.Back]: () => ({ kind: ActionKind.Back }),
  [ActionKind.ChangeTo]: (_target, variant) => ({ kind: ActionKind.ChangeTo, variant })
};

export function retargeted(interaction: Interaction, kind: ActionKind, target: string, variant: Picked = {}): Interaction {
  return { ...interaction, action: ACTION_OF[kind](target, variant, interaction.action) };
}

export function retimed(interaction: Interaction, patch: Record<string, unknown>): Interaction {
  return { ...interaction, transition: transitionSchema.parse({ ...interaction.transition, ...patch }) };
}

export function reoverlaid(interaction: Interaction, patch: Partial<Overlay>): Interaction {
  if (interaction.action.kind !== ActionKind.OpenOverlay) {
    return interaction;
  }
  const overlay = overlaySchema.safeParse({ ...interaction.action.overlay, ...patch });
  return overlay.success ? { ...interaction, action: { ...interaction.action, overlay: overlay.data } } : interaction;
}

const OPAQUE = 255;
const PERCENT = 100;
const RGB_HEX_LENGTH = 7;

export function backdropParts(hex: string): { colour: string; opacity: number } {
  const alpha = hex.length > RGB_HEX_LENGTH ? parseInt(hex.slice(RGB_HEX_LENGTH), 16) : OPAQUE;
  return { colour: hex.slice(0, RGB_HEX_LENGTH), opacity: Math.round((alpha / OPAQUE) * PERCENT) };
}

export function backdropOf(colour: string, opacity: number): string {
  const alpha = Math.round((Math.min(PERCENT, Math.max(0, opacity)) / PERCENT) * OPAQUE);
  return `${colour.slice(0, RGB_HEX_LENGTH)}${alpha.toString(16).padStart(2, '0')}`;
}
