import type { Session } from './session';

export type Env = {
  SESSION: DurableObjectNamespace<Session>;
  RELAY_SIGNING_SECRET: string;
  VISITOR_BASE: string;
  WEB_ORIGIN: string;
};

export const INTENT_HEADER = 'x-feega-intent';
export const EXP_HEADER = 'x-feega-exp';
export const SID_HEADER = 'x-feega-sid';

export enum Intent {
  Host = 'host',
  Visitor = 'visitor'
}

export enum CloseCode {
  Normal = 1000,
  GoingAway = 1001,
  HostGone = 1012,
  Idle = 4000,
  Replaced = 4001,
  Expired = 4002,
  Kicked = 4003,
  Closed = 4004
}
