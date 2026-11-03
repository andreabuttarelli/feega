import { ActionKind, DEFAULT_OVERLAY, TransitionKind, type Action, type Overlay, type Transition } from '@feega/motion-core/motion/prototype/model';

export enum MoveKind {
  Enter = 'enter',
  Open = 'open',
  Close = 'close'
}

export type Visit = { frame: string; transition: Transition };
export type PlayerState = { current: string; history: Visit[]; overlays: string[] };
export type Move = { kind: MoveKind; from: string; to: string; transition: Transition; reverse: boolean; overlay?: Overlay };
export type Step = { state: PlayerState; move: Move | null };

export const startPlayer = (start: string): PlayerState => ({ current: start, history: [], overlays: [] });

const stay = (state: PlayerState): Step => ({ state, move: null });

const topOf = (state: PlayerState): string => state.overlays.at(-1) ?? state.current;

function enter(state: PlayerState, target: string, transition: Transition, known: ReadonlySet<string>): Step {
  if (!known.has(target) || target === state.current) {
    return stay(state);
  }
  return {
    state: { current: target, history: [...state.history, { frame: state.current, transition }], overlays: [] },
    move: { kind: MoveKind.Enter, from: state.current, to: target, transition, reverse: false }
  };
}

function open(state: PlayerState, target: string, overlay: Overlay, transition: Transition, known: ReadonlySet<string>): Step {
  if (!known.has(target)) {
    return stay(state);
  }
  return {
    state: { ...state, overlays: [...state.overlays, target] },
    move: { kind: MoveKind.Open, from: topOf(state), to: target, transition, reverse: false, overlay }
  };
}

function back(state: PlayerState, transition: Transition): Step {
  const overlay = state.overlays.at(-1);
  if (overlay) {
    return {
      state: { ...state, overlays: state.overlays.slice(0, -1) },
      move: { kind: MoveKind.Close, from: overlay, to: topOf({ ...state, overlays: state.overlays.slice(0, -1) }), transition, reverse: true }
    };
  }
  const visit = state.history.at(-1);
  if (!visit) {
    return stay(state);
  }
  return {
    state: { current: visit.frame, history: state.history.slice(0, -1), overlays: [] },
    move: { kind: MoveKind.Enter, from: state.current, to: visit.frame, transition: visit.transition, reverse: true }
  };
}

export function act(state: PlayerState, action: Action, transition: Transition, known: ReadonlySet<string>): Step {
  const runs: Record<ActionKind, () => Step> = {
    [ActionKind.Navigate]: () => enter(state, 'target' in action ? action.target : '', transition, known),
    [ActionKind.ScrollTo]: () => enter(state, 'target' in action ? action.target : '', transition, known),
    [ActionKind.OpenOverlay]: () => (action.kind === ActionKind.OpenOverlay ? open(state, action.target, action.overlay ?? DEFAULT_OVERLAY, transition, known) : stay(state)),
    [ActionKind.CloseOverlay]: () => closeOverlay(state, transition),
    [ActionKind.Back]: () => back(state, transition),
    [ActionKind.ChangeTo]: () => stay(state),
    [ActionKind.OpenUrl]: () => stay(state)
  };
  return runs[action.kind]();
}

const closeOverlay = (state: PlayerState, transition: Transition): Step => (state.overlays.length ? back(state, transition) : stay(state));

export const linkOf = (action: Action): string | null => ('url' in action ? action.url : null);

export const closeTopOverlay = (state: PlayerState): Step => closeOverlay(state, { kind: TransitionKind.Instant });
