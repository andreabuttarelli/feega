export enum Outside {
  Hold = 'hold',
  Fallback = 'fallback'
}

export enum PlayMode {
  Autoplay = 'autoplay',
  InView = 'in-view',
  Scrub = 'scrub',
  Paused = 'paused'
}

export enum Liveness {
  Baked = 'baked',
  Live = 'live'
}

export const PLAY_MODES = Object.values(PlayMode) as [PlayMode, ...PlayMode[]];
export const OUTSIDES = Object.values(Outside) as [Outside, ...Outside[]];

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  [PlayMode.Autoplay]: 'Autoplay',
  [PlayMode.InView]: 'Play when scrolled into view',
  [PlayMode.Scrub]: 'Scroll scrubs the timeline',
  [PlayMode.Paused]: 'Start paused'
};

export const SCROLL_LENGTH = { min: 1, max: 10, default: 3 } as const;

export type Interactive = { playback: PlayMode; loop: boolean; outside: Outside; scrollLength: number };

export const DEFAULT_INTERACTIVE: Interactive = { playback: PlayMode.Autoplay, loop: true, outside: Outside.Fallback, scrollLength: SCROLL_LENGTH.default };

export function interactiveOf(doc: { interactive?: Partial<Interactive> }): Interactive {
  return { ...DEFAULT_INTERACTIVE, ...doc.interactive };
}
