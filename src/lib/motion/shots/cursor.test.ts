import { describe, expect, it } from 'vitest';
import { motionJolts } from '../smoothness';
import { CURSOR_SLOT, CursorAction, CursorShape, cursorMath, type CursorStep } from './cursor';

const math = cursorMath();

const BOXES: Record<string, { x: number; y: number; w: number; h: number; role: string }> = {
  'input-0': { x: 400, y: 300, w: 600, h: 60, role: 'input' },
  'button-0': { x: 1050, y: 370, w: 40, h: 40, role: 'button' },
  'link-0': { x: 100, y: 40, w: 80, h: 20, role: 'link' },
  'card-0': { x: 300, y: 500, w: 600, h: 200, role: 'card' }
};
const UI = { width: 1280, height: 800, box: (id: string) => BOXES[id] ?? null };
const DURATION = 4;
const FPS = 60;

const SCRIPT: CursorStep[] = [
  { target: 'input-0', action: CursorAction.Type, text: 'a launch film' },
  { target: 'button-0', action: CursorAction.Click },
  { target: 'card-0', action: CursorAction.Hover }
];

const frames = (plan: ReturnType<typeof math.plan>) => Array.from({ length: DURATION * FPS + 1 }, (_, i) => math.pose(plan, i / FPS));

describe('the cursor slot', () => {
  it('takes a script of element ids and actions, and refuses a made-up action', () => {
    expect(CURSOR_SLOT.safeParse(SCRIPT).success).toBe(true);
    expect(CURSOR_SLOT.safeParse([{ target: 'button-0', action: 'drag' }]).success).toBe(false);
    expect(CURSOR_SLOT.safeParse([{ target: 'Send', action: 'click' }]).success).toBe(false);
  });
});

describe('the cursor plan', () => {
  it('runs the steps one after another inside the shot, typing at a human pace', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const [type, click, hover] = plan.steps;

    expect(type.at).toBeGreaterThan(0);
    expect(click.at).toBeGreaterThan(type.end);
    expect(hover.at).toBeGreaterThan(click.end);
    expect(hover.end).toBeLessThanOrEqual(DURATION);
    expect('a launch film'.length / (type.end - type.at)).toBeLessThanOrEqual(20);
  });

  it('keeps a time the script gives', () => {
    const plan = math.plan([{ target: 'button-0', action: CursorAction.Click, at: 2.5 }], UI, DURATION);

    expect(plan.steps[0].at).toBe(2.5);
  });

  it('drops a step on an element the UI does not have', () => {
    expect(math.plan([{ target: 'button-9', action: CursorAction.Click }], UI, DURATION).steps).toEqual([]);
  });

  it('writes a sensible script from the element roles when none is given', () => {
    expect(math.auto([{ id: 'input-0', text: 'hi' }, { id: 'button-0' }, { id: 'card-0' }], UI)).toEqual([
      { target: 'input-0', action: CursorAction.Type, text: 'hi' },
      { target: 'button-0', action: CursorAction.Click },
      { target: 'card-0', action: CursorAction.Hover }
    ]);
  });
});

describe('the cursor pose', () => {
  it('is a pure function of time', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const times = [3.1, 0.4, 2.2, 0.4, 3.1];

    expect(times.map((t) => math.pose(plan, t))).toEqual([...times].reverse().map((t) => math.pose(plan, t)).reverse());
  });

  it('lands inside the element it clicks at the moment of the click', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const click = plan.steps[1];
    const b = BOXES['button-0'];
    const at = math.pose(plan, click.at);

    expect(at.x).toBeGreaterThanOrEqual(b.x);
    expect(at.x).toBeLessThanOrEqual(b.x + b.w);
    expect(at.y).toBeGreaterThanOrEqual(b.y);
    expect(at.y).toBeLessThanOrEqual(b.y + b.h);
  });

  it('never jumps between two frames: the smoothness check finds no pop, stop or flicker', () => {
    const poses = frames(math.plan(SCRIPT, UI, DURATION));
    const steps = poses.slice(1).map((p, i) => Math.hypot(p.x - poses[i].x, p.y - poses[i].y));

    expect(motionJolts(steps)).toEqual([]);
    expect(Math.max(...steps)).toBeLessThan(UI.width * 0.08);
  });

  it('travels on a curve, not a straight line', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const [type, click] = plan.steps;
    const a = math.pose(plan, type.end);
    const b = math.pose(plan, click.at);
    const mid = math.pose(plan, (click.travel + click.at) / 2);
    const off = Math.abs((b.x - a.x) * (a.y - mid.y) - (a.x - mid.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);

    expect(off).toBeGreaterThan(4);
  });

  it('overshoots the target slightly and settles on it before it clicks', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const click = plan.steps[1];
    const centre = math.pose(plan, click.at);
    const before = Array.from({ length: 12 }, (_, i) => math.pose(plan, click.at - (i + 1) / FPS));
    const b = BOXES['button-0'];

    expect(Math.max(...before.map((p) => p.x))).toBeGreaterThan(centre.x + 0.5);
    expect(centre).toMatchObject({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  });

  it('presses on a click and the ripple grows from the click point', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const click = plan.steps[1];

    expect(math.pose(plan, click.at - 0.2).press).toBe(0);
    expect(math.pose(plan, click.at + 0.08).press).toBeGreaterThan(0.5);
    expect(math.pose(plan, click.at + 0.1).ripple?.p).toBeGreaterThan(0);
    expect(math.pose(plan, click.at + 1.2).ripple).toBeNull();
  });

  it('hovers the element it rests on and types into a field', () => {
    const plan = math.plan(SCRIPT, UI, DURATION);
    const [type, , hover] = plan.steps;

    const typed = math.pose(plan, (type.at + type.end) / 2).typed;

    expect(typed).toMatchObject([{ target: 'input-0', text: 'a launch film' }]);
    expect(typed[0].p).toBeGreaterThan(0);
    expect(typed[0].p).toBeLessThan(1);
    expect(math.pose(plan, DURATION).typed[0].p).toBe(1);
    expect(math.pose(plan, hover.at + 0.1).hover).toBe('card-0');
  });

  it('shows an I-beam over a field, a hand over a link, an arrow elsewhere', () => {
    const plan = math.plan([...SCRIPT, { target: 'link-0', action: CursorAction.Hover }], UI, DURATION);
    const [type, click, , link] = plan.steps;

    expect(math.pose(plan, type.at + 0.05).shape).toBe(CursorShape.Beam);
    expect(math.pose(plan, click.at).shape).toBe(CursorShape.Arrow);
    expect(math.pose(plan, link.at + 0.05).shape).toBe(CursorShape.Hand);
  });

  it('scrolls the page under a still cursor', () => {
    const plan = math.plan([{ target: 'card-0', action: CursorAction.Scroll, text: '300' }], UI, DURATION);
    const step = plan.steps[0];

    expect(math.pose(plan, step.at).scroll).toBe(0);
    expect(math.pose(plan, step.end).scroll).toBeCloseTo(300, 0);
  });
});
