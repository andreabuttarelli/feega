// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playerMain, type PlayerConfig } from './player';
import { gestureScrub, readHost, selfScroll, HOST_MESSAGE } from './host';
import { fitBox, FIT_SCALE } from './fit';
import { LINK_MESSAGE, NATIVE_BRIDGE, PLAYER_MESSAGE, PROTOCOL_VERSION, PlayerEvent } from './protocol';
import { PlayMode } from './settings';

type Spy = ReturnType<typeof vi.fn>;
type Fake = HTMLElement & { seek: Spy; play: Spy; pause: Spy; iframeElement: { contentWindow: { postMessage: Spy }; focus: () => void } };

const config = (playback: string): PlayerConfig => ({
  html: '<p></p>',
  width: 1920,
  height: 1080,
  duration: 10,
  playback,
  loop: false,
  modes: { autoplay: PlayMode.Autoplay, inView: PlayMode.InView, scrub: PlayMode.Scrub },
  inputMessage: 'feega:input',
  eventMessage: 'feega:event',
  hostMessage: HOST_MESSAGE,
  playerMessage: PLAYER_MESSAGE,
  linkMessage: LINK_MESSAGE,
  nativeBridge: NATIVE_BRIDGE,
  protocol: PROTOCOL_VERSION,
  events: { ...PlayerEvent },
  selfScroll: 'self-scroll',
  standaloneMs: 500,
  fitScale: FIT_SCALE,
  scrollLength: 3,
  keys: { x: 'pointer.x', y: 'pointer.y', down: 'pointer.down', hover: 'hover', tiltX: 'tilt.x', tiltY: 'tilt.y', scroll: 'scroll', time: 'time' }
});

let sent: Array<Record<string, unknown>>;
let el: Fake;
let child: { postMessage: Spy };

function mount(playback: string = PlayMode.Paused): void {
  document.body.innerHTML = '<div id="stage"><div id="player"></div><div id="pad"></div></div>';
  el = document.getElementById('player') as Fake;
  child = { postMessage: vi.fn() };
  Object.assign(el, { seek: vi.fn(), play: vi.fn(), pause: vi.fn(), iframeElement: { contentWindow: child, focus: () => undefined } });
  playerMain(config(playback), readHost, selfScroll, fitBox, gestureScrub);
}

const host = (m: Record<string, unknown>) => window.dispatchEvent(new MessageEvent('message', { data: { type: HOST_MESSAGE, ...m } }));
const events = (name: PlayerEvent) => sent.filter((m) => m.event === name);
const ready = () => el.dispatchEvent(new Event('ready'));

beforeEach(() => {
  sent = [];
  Object.assign(window, {
    [NATIVE_BRIDGE]: { postMessage: (s: string) => sent.push(JSON.parse(s)) },
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: class {
      observe() {}
    }
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
});

afterEach(() => vi.restoreAllMocks());

describe('the player speaking to its host', () => {
  it('announces its size at once and ready once the video is loaded, versioned', () => {
    mount();
    expect(events(PlayerEvent.Size)[0]).toMatchObject({ type: PLAYER_MESSAGE, v: PROTOCOL_VERSION, width: 1920, height: 1080, aspect: 1920 / 1080 });
    expect(events(PlayerEvent.Ready)).toHaveLength(0);

    ready();

    expect(events(PlayerEvent.Ready)[0]).toMatchObject({ duration: 10, playback: PlayMode.Paused });
  });

  it('reports time and the end', () => {
    mount();
    el.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime: 4 } }));
    el.dispatchEvent(new Event('ended'));

    expect(events(PlayerEvent.TimeUpdate)[0]).toMatchObject({ time: 4, duration: 10 });
    expect(events(PlayerEvent.Ended)).toHaveLength(1);
  });

  it('reports a playback error with its message', () => {
    mount();
    el.dispatchEvent(new CustomEvent('playbackerror', { detail: { error: new Error('decode') } }));

    expect(events(PlayerEvent.Error)[0]).toMatchObject({ message: 'decode' });
  });
});

describe('the player obeying its host', () => {
  it('plays, pauses and seeks on command, and holds a command sent before ready', () => {
    mount();
    host({ command: 'play' });
    expect(el.play).not.toHaveBeenCalled();

    ready();
    expect(el.play).toHaveBeenCalledTimes(1);

    el.dispatchEvent(new Event('play'));
    host({ command: 'pause' });
    host({ command: 'seek', time: 3 });

    expect(el.pause).toHaveBeenCalledTimes(1);
    expect(el.seek).toHaveBeenLastCalledWith(3);
  });

  it('does not autoplay when the host asks for reduced motion', () => {
    mount(PlayMode.Autoplay);
    host({ reducedMotion: true });
    ready();

    expect(el.play).not.toHaveBeenCalled();
  });

  it('feeds an app pointer and tilt to the video inputs', () => {
    let tick: FrameRequestCallback = () => undefined;
    vi.mocked(window.requestAnimationFrame).mockImplementation((fn) => ((tick = fn), 0));
    mount();
    host({ pointer: { x: 0.2, y: 0.4, down: true }, tilt: { x: 0.5, y: -0.5 } });
    tick(0);

    expect(child.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ values: expect.objectContaining({ 'pointer.x': 0.2, 'pointer.y': 0.4, 'pointer.down': 1, hover: 1, 'tilt.x': 0.5, 'tilt.y': -0.5 }) }), '*');
  });
});

describe('a link the video opens', () => {
  const link = (url: string) => window.dispatchEvent(new MessageEvent('message', { data: { type: LINK_MESSAGE, url }, source: child as never }));

  it('opens it itself when no host claimed links', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mount();
    link('https://feega.app/');

    expect(open).toHaveBeenCalledWith('https://feega.app/', '_blank', 'noopener');
    expect(events(PlayerEvent.Link)).toHaveLength(0);
  });

  it('hands it to a host that claimed links, and refuses anything but http', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mount();
    host({ links: 'host' });
    link('https://feega.app/');
    link('javascript:alert(1)');

    expect(open).not.toHaveBeenCalled();
    expect(events(PlayerEvent.Link)).toEqual([expect.objectContaining({ url: 'https://feega.app/' })]);
  });

  it('ignores a link message that does not come from the video', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mount();
    window.dispatchEvent(new MessageEvent('message', { data: { type: LINK_MESSAGE, url: 'https://evil.example/' } }));

    expect(open).not.toHaveBeenCalled();
  });
});
