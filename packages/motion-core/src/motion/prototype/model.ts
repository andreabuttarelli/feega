import { z } from 'zod';
import { EASE_IDS, Ease } from '../design';

export enum TriggerKind {
  Click = 'click',
  Hover = 'hover',
  Drag = 'drag',
  AfterDelay = 'after_delay'
}

export enum ActionKind {
  Navigate = 'navigate',
  OpenOverlay = 'open_overlay',
  Back = 'back',
  ScrollTo = 'scroll_to'
}

export enum TransitionKind {
  Instant = 'instant',
  Dissolve = 'dissolve',
  Slide = 'slide',
  Push = 'push'
}

export enum Direction {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down'
}

export const TRIGGER_KINDS = Object.values(TriggerKind) as [TriggerKind, ...TriggerKind[]];
export const ACTION_KINDS = Object.values(ActionKind) as [ActionKind, ...ActionKind[]];
export const TRANSITION_KINDS = Object.values(TransitionKind) as [TransitionKind, ...TransitionKind[]];
export const DIRECTIONS = Object.values(Direction) as [Direction, ...Direction[]];

export const MAX_INTERACTIONS = 16;
export const MAX_DELAY_MS = 60_000;
export const MAX_DURATION_MS = 10_000;
export const DEFAULT_DELAY_MS = 1000;
export const DEFAULT_DURATION_MS = 300;

const target = z.string().min(1);

export const triggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(TriggerKind.Click) }),
  z.object({ kind: z.literal(TriggerKind.Hover) }),
  z.object({ kind: z.literal(TriggerKind.Drag) }),
  z.object({ kind: z.literal(TriggerKind.AfterDelay), delayMs: z.number().int().min(0).max(MAX_DELAY_MS) })
]);

export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(ActionKind.Navigate), target }),
  z.object({ kind: z.literal(ActionKind.OpenOverlay), target }),
  z.object({ kind: z.literal(ActionKind.Back) }),
  z.object({ kind: z.literal(ActionKind.ScrollTo), target })
]);

const timing = { easing: z.enum(EASE_IDS).default(Ease.Standard), durationMs: z.number().int().min(1).max(MAX_DURATION_MS).default(DEFAULT_DURATION_MS) };

export const transitionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(TransitionKind.Instant) }),
  z.object({ kind: z.literal(TransitionKind.Dissolve), ...timing }),
  z.object({ kind: z.literal(TransitionKind.Slide), direction: z.enum(DIRECTIONS).default(Direction.Left), ...timing }),
  z.object({ kind: z.literal(TransitionKind.Push), direction: z.enum(DIRECTIONS).default(Direction.Left), ...timing })
]);

export const interactionSchema = z.object({
  id: z.string().min(1),
  trigger: triggerSchema,
  action: actionSchema,
  transition: transitionSchema.default({ kind: TransitionKind.Instant })
});

export const interactionsSchema = z.array(interactionSchema).max(MAX_INTERACTIONS);

export type Trigger = z.infer<typeof triggerSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type InteractionInput = z.input<typeof interactionSchema>;

const TARGETED: Record<ActionKind, boolean> = {
  [ActionKind.Navigate]: true,
  [ActionKind.OpenOverlay]: true,
  [ActionKind.Back]: false,
  [ActionKind.ScrollTo]: true
};

export const needsTarget = (kind: ActionKind): boolean => TARGETED[kind];

export const TRIGGER_LABEL: Record<TriggerKind, string> = {
  [TriggerKind.Click]: 'On click',
  [TriggerKind.Hover]: 'While hovering',
  [TriggerKind.Drag]: 'On drag',
  [TriggerKind.AfterDelay]: 'After delay'
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  [ActionKind.Navigate]: 'Navigate to',
  [ActionKind.OpenOverlay]: 'Open overlay',
  [ActionKind.Back]: 'Back',
  [ActionKind.ScrollTo]: 'Scroll to'
};

export const TRANSITION_LABEL: Record<TransitionKind, string> = {
  [TransitionKind.Instant]: 'Instant',
  [TransitionKind.Dissolve]: 'Dissolve',
  [TransitionKind.Slide]: 'Slide in',
  [TransitionKind.Push]: 'Push'
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  [Direction.Left]: 'From right',
  [Direction.Right]: 'From left',
  [Direction.Up]: 'From bottom',
  [Direction.Down]: 'From top'
};
