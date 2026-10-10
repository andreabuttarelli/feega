export enum TourState {
  Due = 'due',
  Seen = 'seen',
  Unknown = 'unknown'
}

export enum TourScene {
  Intro = 'intro',
  Motion = 'motion',
  Canvas = 'canvas',
  Link = 'link',
  Flow = 'flow',
  Start = 'start'
}

export enum TourEvent {
  Slide = 'tour_slide_viewed',
  Skip = 'tour_skipped',
  Finish = 'tour_finished'
}

export const TOUR_LAUNCHED_AT = '2026-10-10T00:00:00Z';
export const TOUR_SEEN_STORAGE_KEY = 'feega:tour-seen';
export const TOUR_SEEN_PATH = '/api/onboarding-tour';
export const MAKE_VIDEO_PATH = '/app#video-brief';

export type TourSeen = { seenAt: string | null } | null;

export type TourSlide = { id: TourScene; title: string; body: string };

export const TOUR_SLIDES: readonly TourSlide[] = [
  { id: TourScene.Intro, title: 'this is feega', body: 'Motion videos from a prompt or a URL. Share them as a file or as an interactive embed.' },
  { id: TourScene.Motion, title: 'motion', body: 'The video editor. Tell the AI chat what you want: it builds the scenes, you tweak them on the timeline.' },
  { id: TourScene.Canvas, title: 'canvas', body: 'An infinite board of nodes: images, videos, text, products, social feeds. You and the AI work on it together.' },
  {
    id: TourScene.Link,
    title: 'one video, one node',
    body: 'Every motion video is a node on a canvas. That is why a new motion also creates a canvas project: the video can connect to everything else.'
  },
  { id: TourScene.Flow, title: 'wire it up', body: 'Connect references, a storyboard or images into the video. Then feed the video into other nodes.' },
  { id: TourScene.Start, title: 'start here', body: 'Make a video now, or open a canvas and collect material first.' }
];

const TOUR_PATH_PREFIXES = ['/app/', '/p/'];

export function tourShowsOn(pathname: string): boolean {
  return TOUR_PATH_PREFIXES.some((prefix) => `${pathname}/`.startsWith(prefix));
}

export function tourStateOf(input: { createdAt: string; seen: TourSeen }): TourState {
  if (new Date(input.createdAt) < new Date(TOUR_LAUNCHED_AT)) {
    return TourState.Seen;
  }
  if (input.seen === null) {
    return TourState.Unknown;
  }
  return input.seen.seenAt ? TourState.Seen : TourState.Due;
}

export function opensOnArrival(state: TourState, seenInBrowser: boolean): boolean {
  if (state === TourState.Unknown) {
    return !seenInBrowser;
  }
  return state === TourState.Due;
}
