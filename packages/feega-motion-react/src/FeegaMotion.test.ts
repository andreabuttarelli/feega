// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createElement, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { FeegaMotion, type FeegaMotionHandle } from './FeegaMotion';
import { HOST_MESSAGE, PLAYER_MESSAGE, PROTOCOL_VERSION, PlayerEvent } from './protocol';

const ID = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
const ORIGIN = 'https://feega.test';
const VIEWPORT = 1000;

type Posted = Record<string, unknown>;

function frameOf(container: HTMLElement) {
  const frame = container.querySelector('iframe')!;
  const posted: Posted[] = [];
  const child = { postMessage: (m: Posted) => posted.push(m) };
  Object.defineProperty(frame, 'contentWindow', { value: child });
  return { frame, posted, child, last: () => posted.filter((m) => 'progress' in m).at(-1) };
}

const fromPlayer = (source: unknown, event: PlayerEvent, data: Posted = {}) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: PLAYER_MESSAGE, v: PROTOCOL_VERSION, event, ...data }, source: source as never }));
  });

const settings = (playback: string, scrollLength = 3) => vi.fn(async () => new Response(JSON.stringify({ width: 1920, height: 1080, playback, scrollLength })));

function boxAt(el: Element, top: number, height: number) {
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
}

beforeEach(() => {
  Object.assign(window, { innerHeight: VIEWPORT, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal('fetch', settings('autoplay'));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<FeegaMotion>', () => {
  it('renders the hosted player in an iframe that fills its parent', () => {
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, fit: 'contain' }));
    const frame = container.querySelector('iframe')!;

    expect(frame.src).toBe(`${ORIGIN}/e/${ID}?fit=contain`);
    expect(frame.getAttribute('allow')).toContain('accelerometer');
    expect((container.firstElementChild as HTMLElement).style.height).toBe('100%');
    expect(frame.style.width).toBe('100%');
  });

  it('renders on the server without touching window', () => {
    expect(renderToString(createElement(FeegaMotion, { id: ID, origin: ORIGIN }))).toContain(`${ORIGIN}/e/${ID}?fit=cover`);
  });

  it('posts its travel through the page as progress on scroll', async () => {
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, scrollLength: 0 }));
    const f = frameOf(container);
    boxAt(container.firstElementChild!, 250, 500);

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(f.last()).toMatchObject({ type: HOST_MESSAGE, progress: 0.5, visible: true });
  });

  it('measures progress against a scroll container it is given', async () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    boxAt(scroller, 100, 400);
    const ref = { current: scroller };
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, scrollLength: 0, scrollContainer: ref }));
    const f = frameOf(container);
    boxAt(container.firstElementChild!, 200, 200);

    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'));
    });

    expect(f.last()).toMatchObject({ progress: 0.5 });
  });

  it('builds a scroll story for a scrub video, as the web loader does', async () => {
    vi.stubGlobal('fetch', settings('scrub', 4));
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN }));

    await act(async () => undefined);

    expect((container.firstElementChild as HTMLElement).style.height).toBe(`${4 * VIEWPORT}px`);
    expect(container.querySelector<HTMLElement>('[data-feega-stage]')!.style.position).toBe('sticky');
  });

  it('calls back on ready, end, time and errors from its own player only', () => {
    const onReady = vi.fn();
    const onEnded = vi.fn();
    const onTimeUpdate = vi.fn();
    const onError = vi.fn();
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, onReady, onEnded, onTimeUpdate, onError }));
    const f = frameOf(container);

    fromPlayer({}, PlayerEvent.Ready, { duration: 9 });
    expect(onReady).not.toHaveBeenCalled();

    fromPlayer(f.child, PlayerEvent.Ready, { width: 1, height: 1, duration: 9, playback: 'scrub', loop: false });
    fromPlayer(f.child, PlayerEvent.TimeUpdate, { time: 2, duration: 9 });
    fromPlayer(f.child, PlayerEvent.Ended);
    fromPlayer(f.child, PlayerEvent.Error, { message: 'boom' });

    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ duration: 9 }));
    expect(onTimeUpdate).toHaveBeenCalledWith(2, 9);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('claims links when it has onLinkClick and hands them over', () => {
    const onLinkClick = vi.fn();
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, onLinkClick }));
    const f = frameOf(container);

    fromPlayer(f.child, PlayerEvent.Size, { width: 16, height: 9, aspect: 16 / 9 });
    fromPlayer(f.child, PlayerEvent.Link, { url: 'https://feega.app/' });

    expect(f.posted).toContainEqual(expect.objectContaining({ type: HOST_MESSAGE, links: 'host' }));
    expect(onLinkClick).toHaveBeenCalledWith('https://feega.app/');
  });

  it('tells the player about reduced motion', () => {
    Object.assign(window, { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN }));
    const f = frameOf(container);

    fromPlayer(f.child, PlayerEvent.Size, { width: 16, height: 9, aspect: 16 / 9 });

    expect(f.posted).toContainEqual(expect.objectContaining({ reducedMotion: true }));
  });

  it('plays, pauses and seeks through its ref', () => {
    const ref = createRef<FeegaMotionHandle>();
    const { container } = render(createElement(FeegaMotion, { id: ID, origin: ORIGIN, ref }));
    const f = frameOf(container);

    ref.current!.play();
    ref.current!.pause();
    ref.current!.seek(1.5);

    expect(f.posted.slice(-3)).toEqual([
      { type: HOST_MESSAGE, command: 'play' },
      { type: HOST_MESSAGE, command: 'pause' },
      { type: HOST_MESSAGE, command: 'seek', time: 1.5 }
    ]);
  });
});
