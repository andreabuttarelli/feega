export type MobileView = 'canvas' | 'chat';

export type ChatTurn = 'idle' | 'running';

export type ChatBadge = 'none' | 'running' | 'unread';

export type MobileViewState = { view: MobileView; unread: boolean };

export const INITIAL_MOBILE_VIEW: MobileViewState = { view: 'canvas', unread: false };

export function showView(state: MobileViewState, view: MobileView): MobileViewState {
  return { view, unread: view === 'chat' ? false : state.unread };
}

export function turnEnded(state: MobileViewState): MobileViewState {
  return { ...state, unread: state.view === 'canvas' };
}

export function chatBadge(state: MobileViewState, turn: ChatTurn): ChatBadge {
  if (turn === 'running') {
    return 'running';
  }
  return state.unread ? 'unread' : 'none';
}
