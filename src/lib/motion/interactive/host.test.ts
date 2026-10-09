import { describe, expect, it, vi } from 'vitest';
import { hostMain, readHost, selfScroll } from './host';

const TYPE = 'feega:host';
const VIEWPORT = 1000;

type Box = { top: number; height: number };

function fakeHost(frame: Box, opts: { wrapper?: Box & { scroll: string }; scrollHeight?: number } = {}) {
  const posted: Array<Record<string, unknown>> = [];
  const listeners: Record<string, () => void> = {};
  const rect = (b: Box) => ({ top: b.top, bottom: b.top + b.height, height: b.height });
  const wrapper = opts.wrapper ? { style: {} as Record<string, string>, getAttribute: () => opts.wrapper!.scroll, getBoundingClientRect: () => rect(opts.wrapper!) } : null;
  const el = {
    style: {} as Record<string, string>,
    contentWindow: { postMessage: (m: Record<string, unknown>) => posted.push(m) },
    getBoundingClientRect: () => rect(frame),
    closest: () => wrapper,
    addEventListener: (name: string, fn: () => void) => (listeners[`frame:${name}`] = fn)
  };
  const win = {
    innerHeight: VIEWPORT,
    scrollY: 0,
    document: { documentElement: { scrollHeight: opts.scrollHeight ?? VIEWPORT } },
    addEventListener: (name: string, fn: () => void) => (listeners[name] = fn)
  };
  hostMain(el as never, TYPE, win as never);
  const last = () => posted[posted.length - 1];
  return { el, wrapper, last, fire: (name: string) => listeners[name]() };
}

describe('the host script', () => {
  it('measures progress along the embed own travel through the viewport, not the page', () => {
    const frame = { top: VIEWPORT, height: 500 };
    const host = fakeHost(frame);

    host.fire('frame:load');
    expect(host.last().progress).toBe(0);

    frame.top = 250;
    host.fire('scroll');
    expect(host.last().progress).toBe(0.5);

    frame.top = -500;
    host.fire('scroll');
    expect(host.last().progress).toBe(1);
    expect(host.last().visible).toBe(false);
  });

  it('keeps the old whole-page scroll field for players already published', () => {
    const host = fakeHost({ top: 0, height: 500 });

    host.fire('frame:load');

    expect(host.last().type).toBe(TYPE);
    expect(host.last().scroll).toBe(0);
  });

  it('turns a data-scroll wrapper into a sticky section N viewports long and scrubs while it sticks', () => {
    const wrapper = { top: 0, height: 3 * VIEWPORT, scroll: '3' };
    const host = fakeHost({ top: 0, height: 500 }, { wrapper });

    expect(host.wrapper!.style.height).toBe('300vh');
    expect(host.el.style.position).toBe('sticky');

    wrapper.top = -1250;
    host.fire('scroll');
    expect(host.last().progress).toBe(0.5);
  });
});

describe('the player reading the host', () => {
  it('prefers the embed progress and falls back to the old page scroll', () => {
    expect(readHost({ type: TYPE, progress: 0.3, scroll: 0.9 }, TYPE)?.progress).toBe(0.3);
    expect(readHost({ type: TYPE, scroll: 0.9, visible: true }, TYPE)).toEqual({ progress: 0.9, visible: true });
    expect(readHost({ type: 'other', progress: 0.3 }, TYPE)).toBeNull();
    expect(readHost(null, TYPE)).toBeNull();
  });
});

describe('the embed opened on its own', () => {
  function fakePage() {
    const classes = new Set<string>();
    const listeners: Record<string, () => void> = {};
    const win = {
      innerHeight: VIEWPORT,
      scrollY: 0,
      scrollTo: vi.fn(),
      document: { documentElement: { scrollHeight: 4 * VIEWPORT, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } } },
      addEventListener: (name: string, fn: () => void) => (listeners[name] = fn),
      removeEventListener: (name: string) => delete listeners[name],
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id)
    };
    return { win, classes, listeners };
  }

  it('scrolls by itself and scrubs when no host speaks within the wait', () => {
    vi.useFakeTimers();
    const page = fakePage();
    const seen: number[] = [];

    selfScroll(page.win as never, 500, 'self-scroll', (p) => seen.push(p));
    vi.advanceTimersByTime(499);
    expect(page.classes.has('self-scroll')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(page.classes.has('self-scroll')).toBe(true);

    page.win.scrollY = 1500;
    page.listeners.scroll();
    expect(seen.at(-1)).toBe(0.5);
    vi.useRealTimers();
  });

  it('gives the scroll back to the host the moment it speaks', () => {
    vi.useFakeTimers();
    const page = fakePage();
    const own = selfScroll(page.win as never, 500, 'self-scroll', () => undefined);

    vi.advanceTimersByTime(600);
    own.cancel();

    expect(page.classes.has('self-scroll')).toBe(false);
    expect(page.listeners.scroll).toBeUndefined();
    vi.useRealTimers();
  });
});
