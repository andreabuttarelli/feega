import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { GuideId } from '..';
import { MOCKS } from '../mock/registry';
import { RETURN_MS, frameAt, stateAt, targetSelector, waypoints } from './script';
import { SCRIPTS } from './scripts';

const IDS = Object.values(GuideId);

describe.each(IDS)('demo script %s', (id) => {
  const script = SCRIPTS[id];
  const names = [script.rest.target, ...script.steps.flatMap((s) => (s.target ? [s.target] : []))];

  it('aims only at elements the mockup draws', () => {
    const { body } = render(MOCKS[id].component, { props: { ...MOCKS[id].props, demo: script.initial } });

    names.forEach((name) => expect(body, name).toContain(`data-t="${name}"`));
  });

  it('lists steps in time order inside the loop', () => {
    const times = script.steps.map((s) => s.at);

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.at(-1)).toBeLessThanOrEqual(script.duration - RETURN_MS);
  });

  it('never starts a move before the previous one has arrived', () => {
    const points = waypoints(script);

    points.slice(1).forEach((point, i) => expect(point.arrive - point.travel, `${point.aim.target}`).toBeGreaterThanOrEqual(points[i].arrive));
  });

  it('loops back to its start state', () => {
    expect(stateAt(script, script.duration)).toEqual(script.initial);
  });

  it('starts and ends the cursor at rest', () => {
    expect(frameAt(script, 0).cursor.from).toEqual(script.rest);
    expect(frameAt(script, script.duration - 1).cursor.progress).toBeGreaterThan(0.99);
  });

  it('is a loop of a few seconds', () => {
    expect(script.duration).toBeGreaterThanOrEqual(4000);
    expect(script.duration).toBeLessThanOrEqual(8000);
  });
});

describe('shared components bar', () => {
  const renderWith = (id: GuideId) => render(MOCKS[id].component, { props: { ...MOCKS[id].props, demo: SCRIPTS[id].initial } }).body;
  const barShown = (body: string) => /class="shared"/.test(body);

  it('stays hidden in the other properties demos', () => {
    [GuideId.States, GuideId.Breakpoints, GuideId.Snap].forEach((id) => expect(barShown(renderWith(id)), id).toBe(false));
  });

  it('shows in the shared demo once the scope is shared', () => {
    const { body } = render(MOCKS[GuideId.Shared].component, { props: { demo: { ...SCRIPTS[GuideId.Shared].initial, scope: 'shared' } } });

    expect(barShown(body)).toBe(true);
  });
});

describe('selector', () => {
  it('matches the data attribute', () => {
    expect(targetSelector('x')).toBe('[data-t="x"]');
  });
});
