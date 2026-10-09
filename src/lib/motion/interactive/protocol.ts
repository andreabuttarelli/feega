export const PROTOCOL_VERSION = 1;
export const PLAYER_MESSAGE = 'feega:player';
export const LINK_MESSAGE = 'feega:link';
export const NATIVE_BRIDGE = 'FeegaHost';

export enum HostCommand {
  Play = 'play',
  Pause = 'pause',
  Seek = 'seek'
}

export enum PlayerEvent {
  Size = 'size',
  Ready = 'ready',
  TimeUpdate = 'timeupdate',
  Ended = 'ended',
  Link = 'link',
  Error = 'error'
}

export type PlayerMessage = { type: typeof PLAYER_MESSAGE; v: typeof PROTOCOL_VERSION; event: PlayerEvent } & Record<string, unknown>;
