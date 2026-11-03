// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installEngine, testTimeline } from './testing';

const BREAKPOINT_COPY = 'tablet:59614c4a';

describe('a tween target names its element by id or class', () => {
  it('finds a breakpoint copy whose id holds a colon', () => {
    document.body.innerHTML = `<div id="kf-${BREAKPOINT_COPY}"></div>`;
    const tl = testTimeline(installEngine());

    tl.set(`#kf-${BREAKPOINT_COPY}`, { opacity: 0.5 }, 0);
    tl.seek(0);

    expect((document.getElementById(`kf-${BREAKPOINT_COPY}`) as HTMLElement).style.opacity).toBe('0.5');
  });

  it('finds the copies of a parent listed after its id', () => {
    document.body.innerHTML = `<div id="kf-${BREAKPOINT_COPY}"></div><div class="kc-${BREAKPOINT_COPY}"></div>`;
    const tl = testTimeline(installEngine());

    tl.set(`#kf-${BREAKPOINT_COPY},.kc-${BREAKPOINT_COPY}`, { opacity: 0.25 }, 0);
    tl.seek(0);

    expect([...document.querySelectorAll('div')].map((el) => (el as HTMLElement).style.opacity)).toEqual(['0.25', '0.25']);
  });
});
