export enum FrameMode {
  Live = 'live',
  Snapshot = 'snapshot'
}

export enum LiveFrameState {
  Idle = 'idle',
  Editing = 'editing',
  Playing = 'playing'
}

export const LIVE_MODE: Record<LiveFrameState, FrameMode> = {
  [LiveFrameState.Idle]: FrameMode.Snapshot,
  [LiveFrameState.Editing]: FrameMode.Live,
  [LiveFrameState.Playing]: FrameMode.Live
};

const stateOf = (id: string, editing: string | null) => (id === editing ? LiveFrameState.Editing : LiveFrameState.Idle);

export function liveFrameModes(ids: readonly string[], editing: string | null): Record<string, FrameMode> {
  return Object.fromEntries(ids.map((id) => [id, LIVE_MODE[stateOf(id, editing)]]));
}
