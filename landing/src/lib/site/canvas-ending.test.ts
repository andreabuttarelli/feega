import { describe, expect, it } from 'vitest';
import { ChromeKind, EndingDrive, OPEN_MARGIN, SCALE_LIMITS, chromeFor, driveFor, endPose, openScroll, progressOf, zoomLabel } from './canvas-ending';

const DESKTOP = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844 };

describe('scroll progress', () => {
  it('is zero until the runway reaches the bottom of the viewport', () => {
    expect(progressOf(900, 600, 900)).toBe(0);
    expect(progressOf(1500, 600, 900)).toBe(0);
  });

  it('grows with the runway that has scrolled into view', () => {
    expect(progressOf(600, 600, 900)).toBeCloseTo(0.5);
  });

  it('stops at one when the page ends', () => {
    expect(progressOf(300, 600, 900)).toBe(1);
    expect(progressOf(-50, 600, 900)).toBe(1);
  });
});

describe('end pose', () => {
  it('fits the frame between the panels and the bars at desktop width', () => {
    const pose = endPose({ w: 1440, h: 1150 }, DESKTOP, chromeFor(DESKTOP.w));
    const reserve = chromeFor(DESKTOP.w).reserve;

    expect(pose.scale).toBeLessThanOrEqual(SCALE_LIMITS.max);
    expect(pose.x).toBeGreaterThanOrEqual(reserve.left);
    expect(pose.x + 1440 * pose.scale).toBeLessThanOrEqual(DESKTOP.w - reserve.right + 0.5);
    expect(pose.y).toBeGreaterThanOrEqual(reserve.top);
    expect(pose.y + 1150 * pose.scale).toBeLessThanOrEqual(DESKTOP.h - reserve.bottom + 0.5);
  });

  it('lands on a whole percentage, so the zoom chip reads the true scale', () => {
    const pose = endPose({ w: 1024, h: 997 }, { w: 1024, h: 768 }, chromeFor(1024));
    expect(Math.round(pose.scale * 100)).toBeCloseTo(pose.scale * 100, 10);
    expect(zoomLabel(pose.scale)).toBe(`${pose.zoom}%`);
  });

  it('never shrinks the page past the lower limit, even when it is tall', () => {
    const pose = endPose({ w: 1440, h: 6000 }, DESKTOP, chromeFor(DESKTOP.w));
    expect(pose.scale).toBe(SCALE_LIMITS.min);
  });

  it('leaves the side panels out on a phone', () => {
    expect(chromeFor(PHONE.w).kind).toBe(ChromeKind.Compact);
    expect(chromeFor(1024).kind).toBe(ChromeKind.Full);
    expect(chromeFor(PHONE.w).reserve.left).toBeLessThan(chromeFor(1024).reserve.left);
  });
});

describe('zoom label', () => {
  it('reads the scale as a whole percentage', () => {
    expect(zoomLabel(1)).toBe('100%');
    expect(zoomLabel(0.56)).toBe('56%');
    expect(zoomLabel(0.555)).toBe('56%');
  });
});

describe('drive', () => {
  it('keeps the plain footer under reduced motion, whatever the browser supports', () => {
    expect(driveFor({ reducedMotion: true, scrollTimeline: true })).toBe(EndingDrive.Still);
    expect(driveFor({ reducedMotion: true, scrollTimeline: false })).toBe(EndingDrive.Still);
  });

  it('lets CSS follow the scroll where scroll timelines exist, and a script elsewhere', () => {
    expect(driveFor({ reducedMotion: false, scrollTimeline: true })).toBe(EndingDrive.Timeline);
    expect(driveFor({ reducedMotion: false, scrollTimeline: false })).toBe(EndingDrive.Script);
  });
});

describe('opening the frame at 100%', () => {
  const at = { scrollY: 12485, runwayTop: 225, view: 900, stuckTop: -230 };

  it('scrolls back to where the zoom starts, so the footer is full size', () => {
    expect(openScroll({ ...at, frameY: 900 })).toBe(12485 - 675);
  });

  it('scrolls further up when the point would sit under the top of the viewport', () => {
    expect(openScroll({ ...at, frameY: 100 })).toBe(12485 - 675 + (-230 + 100 - OPEN_MARGIN));
  });
});
