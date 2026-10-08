export enum PreviewCue {
  Enter = 'enter',
  Leave = 'leave',
  InView = 'in-view',
  OutOfView = 'out-of-view'
}

export enum PreviewInput {
  Hover = 'hover',
  Touch = 'touch'
}

enum Effect {
  Start,
  Stop
}

const CUES: Record<PreviewInput, Partial<Record<PreviewCue, Effect>>> = {
  [PreviewInput.Hover]: { [PreviewCue.Enter]: Effect.Start, [PreviewCue.Leave]: Effect.Stop },
  [PreviewInput.Touch]: { [PreviewCue.InView]: Effect.Start, [PreviewCue.OutOfView]: Effect.Stop }
};

export function playingAfter(current: string | null, card: string, cue: PreviewCue, input: PreviewInput): string | null {
  const effect = CUES[input][cue];
  if (effect === Effect.Start) {
    return card;
  }
  if (effect === Effect.Stop && current === card) {
    return null;
  }
  return current;
}
