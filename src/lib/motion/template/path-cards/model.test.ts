import { describe, expect, it } from 'vitest';
import { PATH_MODEL } from './model';

type Card = { x: number; y: number; opacity: number; scale: number; blur: number; rise: number };
type Frame = { drawn: number; head: { x: number; y: number }; camera: { x: number; y: number }; zoom: number; fade: number; cards: Card[] };
type Layout = { length: number; stops: { s: number; x: number; y: number }[]; cards: { stop: number }[] };
type Model = {
  pathLayout: (p: object, aspect: number) => Layout;
  pathFrame: (layout: Layout, p: object, t: number, length: number) => Frame;
};

const model = new Function(`${PATH_MODEL}; return { pathLayout, pathFrame };`)() as Model;

const PARAMS = { places: 'Fjord Point|Red Rock Ridge|Misty Pass', startAt: 0.4, moveSeconds: 1.6, holdSeconds: 0.9, blur: 3, leave: true };
const LENGTH = 12;
const FPS = 30;
const times = (from = 0, until = LENGTH) => Array.from({ length: Math.round((until - from) * FPS) + 1 }, (_, i) => from + i / FPS);
const layout = (aspect = 16 / 9) => model.pathLayout(PARAMS, aspect);
const frame = (t: number, aspect = 16 / 9) => model.pathFrame(layout(aspect), PARAMS, t, LENGTH);

describe('the path cards model', () => {
  it('puts a place card and a review card at every stop, in path order', () => {
    const l = layout();

    expect(l.stops).toHaveLength(3);
    expect(l.cards).toHaveLength(6);
    l.stops.slice(1).forEach((s, i) => expect(s.s).toBeGreaterThan(l.stops[i].s));
  });

  it('draws the path forward only, and the dot rides its head', () => {
    const path = times().map((t) => frame(t));
    path.slice(1).forEach((f, i) => expect(f.drawn).toBeGreaterThanOrEqual(path[i].drawn - 1e-9));
    expect(frame(0).drawn).toBe(0);
    expect(frame(LENGTH).drawn).toBeCloseTo(1, 6);
  });

  it('never stops the dot once it sets off', () => {
    const drawn = times(PARAMS.startAt + 0.2).map((t) => frame(t).drawn);
    drawn.slice(1).forEach((d, i) => expect(d - drawn[i]).toBeGreaterThan(1e-5));
  });

  it('slows down on each stop while its cards appear, then speeds up again', () => {
    const l = layout();
    const speed = (t: number) => (frame(t + 0.5 / FPS).drawn - frame(t - 0.5 / FPS).drawn) * FPS;
    l.stops.forEach((stop, i) => {
      const arrived = times().find((t) => frame(t).drawn >= stop.s - 1e-6)!;
      const cards = frame(arrived + 0.8).cards.filter((_, k) => l.cards[k].stop === i);

      expect(speed(arrived)).toBeLessThan(speed(arrived - 0.8) * 0.5);
      expect(speed(arrived)).toBeLessThan(speed(arrived + 0.8) * 0.5);
      cards.forEach((c) => expect(c.opacity).toBeGreaterThan(0.9));
      expect(frame(arrived - 0.6).cards.filter((_, k) => l.cards[k].stop === i).every((c) => c.opacity < 0.05)).toBe(true);
    });
  });

  it('changes speed without a jerk', () => {
    const drawn = times().map((t) => frame(t).drawn);
    const speeds = drawn.slice(1).map((d, i) => d - drawn[i]);
    speeds.slice(1).forEach((v, i) => expect(Math.abs(v - speeds[i])).toBeLessThan(0.0012));
  });

  it('zooms in softly on each stop and back out after', () => {
    const l = layout();
    l.stops.forEach((stop) => {
      const arrived = times().find((t) => frame(t).drawn >= stop.s - 1e-6)!;
      expect(frame(arrived).zoom).toBeGreaterThan(frame(arrived - 1.2).zoom + 0.03);
      expect(frame(arrived).zoom).toBeGreaterThan(frame(arrived + 1.2).zoom + 0.03);
    });
    const zooms = times().map((t) => frame(t).zoom);
    const steps = zooms.slice(1).map((z, i) => z - zooms[i]);
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(0.002));
  });

  it('keeps the head in frame: the camera follows it', () => {
    times().forEach((t) => {
      const f = frame(t);
      expect(Math.abs(f.head.x - f.camera.x)).toBeLessThan(0.8);
      expect(Math.abs(f.head.y - f.camera.y)).toBeLessThan(0.45);
    });
  });

  it('moves the camera without a jerk', () => {
    const xs = times().map((t) => frame(t).camera.x);
    const steps = xs.slice(1).map((x, i) => x - xs[i]);
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(0.03));
  });

  it('blurs the cards far from the camera, never more than the cap', () => {
    const f = frame(9.6);
    const blurs = f.cards.map((c) => c.blur);

    expect(Math.max(...blurs)).toBeGreaterThan(0.5);
    expect(Math.min(...blurs)).toBe(0);
    blurs.forEach((b) => expect(b).toBeLessThanOrEqual(PARAMS.blur + 1e-9));
  });

  it('pops cards without overshoot', () => {
    times().forEach((t) => frame(t).cards.forEach((c) => expect(c.scale).toBeLessThanOrEqual(1 + 1e-9)));
  });

  it('closes the loop: first and last frames are both empty', () => {
    expect(frame(0).fade).toBe(1);
    expect(frame(LENGTH).fade).toBeCloseTo(0, 6);
    frame(0).cards.forEach((c) => expect(c.opacity).toBe(0));
  });

  it('lays the path along the long side of the frame', () => {
    const wide = layout(16 / 9).stops;
    const tall = layout(9 / 16).stops;

    expect(Math.abs(wide[2].x - wide[0].x)).toBeGreaterThan(Math.abs(wide[2].y - wide[0].y));
    expect(Math.abs(tall[2].y - tall[0].y)).toBeGreaterThan(Math.abs(tall[2].x - tall[0].x));
  });

  it('is a pure function of t', () => {
    const at = [0.3, 2, 6.4, 11.8];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();
    expect(backward).toEqual(forward);
  });
});
