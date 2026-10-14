export enum TourState {
  Due = 'due',
  Seen = 'seen',
  Unknown = 'unknown'
}

export enum TourScene {
  Make = 'make',
  Edit = 'edit',
  Canvas = 'canvas',
  Connect = 'connect',
  Share = 'share',
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
  {
    id: TourScene.Make,
    title: 'paste a link. get a launch video.',
    body: 'Give feega your website or a one-line idea. It writes the script, builds every scene and sets it to music.'
  },
  {
    id: TourScene.Edit,
    title: 'change it by asking.',
    body: 'Tell the chat what to fix: a shorter intro, your colours, a new last line. It edits the timeline while you watch.'
  },
  {
    id: TourScene.Canvas,
    title: 'every video lives on a canvas.',
    body: 'Each video is a node on its project’s canvas, next to the images and notes behind it. Open it from there any time.'
  },
  {
    id: TourScene.Connect,
    title: 'connect anything into it.',
    body: 'Wire your logo, product shots or a storyboard into the video and the next edit uses them. Wire the video out to make a cut-down.'
  },
  {
    id: TourScene.Share,
    title: 'download it, or embed it live.',
    body: 'Export an mp4 for any feed, or paste one line of code to play it on your site, sharp at any size.'
  },
  {
    id: TourScene.Start,
    title: 'start with your link.',
    body: 'Paste your website and get a first cut in minutes. Or open a canvas and gather material first.'
  }
];

const TOUR_PATH_PREFIXES = ['/app/', '/p/'];

export function tourShowsOn(pathname: string): boolean {
  return TOUR_PATH_PREFIXES.some((prefix) => `${pathname}/`.startsWith(prefix));
}

export function predatesOnboarding(createdAt: string): boolean {
  return new Date(createdAt) < new Date(TOUR_LAUNCHED_AT);
}

export function tourStateOf(input: { createdAt: string; seen: TourSeen }): TourState {
  if (predatesOnboarding(input.createdAt)) {
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
