export const PROTOCOL_VERSION = 1;
export const HOST_MESSAGE = 'feega:host';
export const PLAYER_MESSAGE = 'feega:player';
export const EMBED_ROUTE = '/e';
export const DEFAULT_ORIGIN = 'https://oh.feega.app';
export const SCRUB_PLAYBACK = 'scrub';

export enum Fit {
  Cover = 'cover',
  Contain = 'contain'
}

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
  Error = 'error',
  Vars = 'vars'
}

export enum VarKind {
  Number = 'number',
  Boolean = 'boolean',
  Enum = 'enum',
  Color = 'color',
  String = 'string'
}

export type VarValue = number | boolean | string;
export type VarValues = Record<string, VarValue>;

export type VarDecl =
  | { name: string; kind: VarKind.Number | 'number'; default: number; min: number; max: number }
  | { name: string; kind: VarKind.Boolean | 'boolean'; default: boolean }
  | { name: string; kind: VarKind.Enum | 'enum'; default: string; options: string[] }
  | { name: string; kind: VarKind.Color | 'color'; default: string }
  | { name: string; kind: VarKind.String | 'string'; default: string };

export function changedVars(sent: VarValues, next: VarValues): VarValues | null {
  const changed = Object.entries(next).filter(([name, value]) => sent[name] !== value);
  return changed.length ? Object.fromEntries(changed) : null;
}

export type Point = { x: number; y: number };

export type HostMessage = {
  type: typeof HOST_MESSAGE;
  progress?: number;
  visible?: boolean;
  gesture?: boolean;
  command?: HostCommand;
  time?: number;
  fit?: Fit;
  links?: 'host';
  reducedMotion?: boolean;
  pointer?: Point & { down: boolean };
  tilt?: Point;
  vars?: VarValues;
};

export type ReadyInfo = { width: number; height: number; duration: number; playback: string; loop: boolean; vars: VarDecl[]; values: VarValues };

export type PlayerMessage =
  | ({ event: PlayerEvent.Size } & { width: number; height: number; aspect: number })
  | ({ event: PlayerEvent.Ready } & ReadyInfo)
  | { event: PlayerEvent.TimeUpdate; time: number; duration: number }
  | { event: PlayerEvent.Ended }
  | { event: PlayerEvent.Link; url: string }
  | { event: PlayerEvent.Error; message: string }
  | { event: PlayerEvent.Vars; values: VarValues };

export type EmbedSettings = { width: number; height: number; playback: string; scrollLength: number };

export function readPlayer(data: unknown): PlayerMessage | null {
  const m = data as { type?: unknown; v?: unknown; event?: unknown } | null;
  if (m?.type !== PLAYER_MESSAGE || m.v !== PROTOCOL_VERSION) {
    return null;
  }
  return Object.values(PlayerEvent).includes(m.event as PlayerEvent) ? (m as PlayerMessage) : null;
}

export const embedSrc = (origin: string, id: string, fit: Fit) => `${origin}${EMBED_ROUTE}/${encodeURIComponent(id)}?fit=${fit}`;

export const settingsUrl = (origin: string, id: string) => `${origin}${EMBED_ROUTE}/${encodeURIComponent(id)}.json`;
