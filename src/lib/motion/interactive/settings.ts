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

export type Interactive = { playback: PlayMode; loop: boolean; outside: Outside };

export const DEFAULT_INTERACTIVE: Interactive = { playback: PlayMode.Autoplay, loop: true, outside: Outside.Fallback };

export function interactiveOf(doc: { interactive?: Interactive }): Interactive {
  return doc.interactive ?? DEFAULT_INTERACTIVE;
}
