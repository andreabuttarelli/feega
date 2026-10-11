import { describe, expect, it } from 'vitest';
import { TOUR_LAUNCHED_AT, TOUR_SLIDES, TourScene, TourState, tourShowsOn, tourStateOf, opensOnArrival } from './tour';

const NEW_USER = '2026-10-12T09:00:00Z';
const OLD_USER = '2026-01-01T09:00:00Z';
const TITLE_MAX = 40;
const BODY_MAX = 170;

describe('who the tour opens for', () => {
  it('a new user who has not seen it is due', () => {
    expect(tourStateOf({ createdAt: NEW_USER, seen: { seenAt: null } })).toBe(TourState.Due);
  });

  it('a user who has seen it is not shown it again', () => {
    expect(tourStateOf({ createdAt: NEW_USER, seen: { seenAt: '2026-10-12T10:00:00Z' } })).toBe(TourState.Seen);
  });

  it('a user who signed up before the tour existed counts as seen', () => {
    expect(new Date(OLD_USER) < new Date(TOUR_LAUNCHED_AT)).toBe(true);
    expect(tourStateOf({ createdAt: OLD_USER, seen: { seenAt: null } })).toBe(TourState.Seen);
  });

  it('without the column the browser decides, but only for new users', () => {
    expect(tourStateOf({ createdAt: NEW_USER, seen: null })).toBe(TourState.Unknown);
    expect(tourStateOf({ createdAt: OLD_USER, seen: null })).toBe(TourState.Seen);
  });
});

describe('opening on arrival', () => {
  it('due opens, seen does not', () => {
    expect(opensOnArrival(TourState.Due, false)).toBe(true);
    expect(opensOnArrival(TourState.Seen, false)).toBe(false);
  });

  it('unknown falls back to what this browser remembers', () => {
    expect(opensOnArrival(TourState.Unknown, false)).toBe(true);
    expect(opensOnArrival(TourState.Unknown, true)).toBe(false);
  });
});

describe('where the tour lives', () => {
  it('in the app and on canvases, not on public pages or embeds', () => {
    expect(tourShowsOn('/app')).toBe(true);
    expect(tourShowsOn('/p/p1/c/c1')).toBe(true);
    expect(tourShowsOn('/gallery')).toBe(false);
    expect(tourShowsOn('/e/abc')).toBe(false);
  });
});

describe('the slides', () => {
  it('go from making a video to where it lives, and end with two ways in', () => {
    expect(TOUR_SLIDES.map((s) => s.id)).toEqual([
      TourScene.Make,
      TourScene.Edit,
      TourScene.Canvas,
      TourScene.Connect,
      TourScene.Share,
      TourScene.Start
    ]);
  });

  it('name the outcome in a short lowercase title', () => {
    for (const slide of TOUR_SLIDES) {
      expect(slide.title).toBe(slide.title.toLowerCase());
      expect(slide.title.length).toBeLessThanOrEqual(TITLE_MAX);
    }
  });

  it('answer what to do in at most two sentences', () => {
    for (const slide of TOUR_SLIDES) {
      expect(slide.body.length).toBeLessThanOrEqual(BODY_MAX);
      expect(slide.body.split(/[.!?](?:\s|$)/).filter((p) => p.trim()).length).toBeLessThanOrEqual(2);
    }
  });

  it('say in the title that every video lives on a canvas', () => {
    const canvas = TOUR_SLIDES.find((s) => s.id === TourScene.Canvas);
    expect(canvas?.title).toMatch(/video.*canvas/);
  });
});
