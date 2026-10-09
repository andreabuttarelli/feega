import type { gestureScrub, readHost, selfScroll } from './host';
import type { fitBox } from './fit';

export type PlayerConfig = {
  html: string;
  width: number;
  height: number;
  duration: number;
  playback: string;
  loop: boolean;
  modes: { autoplay: string; inView: string; scrub: string };
  inputMessage: string;
  eventMessage: string;
  hostMessage: string;
  playerMessage: string;
  linkMessage: string;
  nativeBridge: string;
  protocol: number;
  events: Record<'Size' | 'Ready' | 'TimeUpdate' | 'Ended' | 'Link' | 'Error', string>;
  selfScroll: string;
  standaloneMs: number;
  fitScale: Record<string, 'max' | 'min'>;
  scrollLength: number;
  keys: { x: string; y: string; down: string; hover: string; tiltX: string; tiltY: string; scroll: string; time: string };
};

type PlayerEl = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; iframeElement?: HTMLIFrameElement };
type Bridge = { postMessage: (message: string) => void };
type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

export function playerMain(cfg: PlayerConfig, read: typeof readHost, own: typeof selfScroll, fit: typeof fitBox, swipe: typeof gestureScrub): void {
  const TILT_DEGREES = 45;
  const UPRIGHT_BETA = 45;
  const el = document.getElementById('player') as PlayerEl;
  const pad = document.getElementById('pad') as HTMLElement;
  const values: Record<string, number> = {};
  const started = performance.now();
  let ready = false;
  let playing = false;
  let asked = false;
  let swiping = false;
  let hostLinks = false;
  let pending: (() => void) | null = null;

  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const post = () => el.iframeElement?.contentWindow?.postMessage({ type: cfg.inputMessage, values }, '*');
  const send = (event: object) => el.iframeElement?.contentWindow?.postMessage({ type: cfg.eventMessage, ...event }, '*');
  const play = () => {
    if (ready && !playing) {
      el.play();
    }
  };
  const pause = () => {
    if (ready && playing) {
      el.pause();
    }
  };
  const emit = (event: string, data: object = {}) => {
    const message = { type: cfg.playerMessage, v: cfg.protocol, event, ...data };
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
    (window as unknown as Record<string, Bridge | undefined>)[cfg.nativeBridge]?.postMessage(JSON.stringify(message));
  };
  let still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scaleOf = (fit: string | null) => Math[cfg.fitScale[fit ?? ''] ?? cfg.fitScale.cover];
  let scaleBy = scaleOf(new URLSearchParams(location.search).get('fit'));
  const content = () => {
    const r = pad.getBoundingClientRect();
    const box = fit(r, cfg, scaleBy);
    return { ...box, left: r.left + box.left, top: r.top + box.top };
  };
  const layout = () => {
    const box = fit(pad.getBoundingClientRect(), cfg, scaleBy);
    Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  };
  addEventListener('resize', layout);
  layout();
  emit(cfg.events.Size, { width: cfg.width, height: cfg.height, aspect: cfg.width / cfg.height });
  const point = (e: PointerEvent) => {
    const box = content();
    values[cfg.keys.x] = (e.clientX - box.left) / box.width;
    values[cfg.keys.y] = (e.clientY - box.top) / box.height;
    values[cfg.keys.hover] = 1;
    send({ kind: e.type, x: values[cfg.keys.x], y: values[cfg.keys.y] });
  };
  const key = (e: KeyboardEvent) => send({ kind: e.type, key: e.key, code: e.code });
  const askTilt = () => {
    const orientation = window.DeviceOrientationEvent as Orientation | undefined;
    if (asked || !orientation?.requestPermission) {
      return;
    }
    asked = true;
    orientation.requestPermission().catch(() => undefined);
  };

  pad.addEventListener('pointermove', point);
  pad.addEventListener('pointerdown', (e) => {
    point(e);
    values[cfg.keys.down] = 1;
    askTilt();
    el.iframeElement?.focus();
  });
  pad.addEventListener('mousedown', (e) => e.preventDefault());
  pad.addEventListener('pointerup', (e) => {
    point(e);
    values[cfg.keys.down] = 0;
  });
  addEventListener('keydown', key);
  addEventListener('keyup', key);
  pad.addEventListener('pointerleave', () => {
    delete values[cfg.keys.x];
    delete values[cfg.keys.y];
    values[cfg.keys.hover] = 0;
    values[cfg.keys.down] = 0;
  });
  addEventListener('deviceorientation', (e) => {
    if (e.gamma === null || e.beta === null) {
      return;
    }
    values[cfg.keys.tiltX] = clamp(e.gamma / TILT_DEGREES);
    values[cfg.keys.tiltY] = clamp((e.beta - UPRIGHT_BETA) / TILT_DEGREES);
  });
  let progress: number | undefined;
  const scrub = (p: number) => {
    progress = p;
    values[cfg.keys.scroll] = p;
    if (cfg.playback === cfg.modes.scrub && ready) {
      el.seek(p * cfg.duration);
    }
  };
  const standalone = cfg.playback === cfg.modes.scrub ? own(window, cfg.standaloneMs, cfg.selfScroll, scrub) : null;
  const openLink = (url: unknown) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return;
    }
    if (hostLinks) {
      emit(cfg.events.Link, { url });
      return;
    }
    window.open(url, '_blank', 'noopener');
  };
  const commands: Record<string, (time?: number) => void> = {
    play: () => el.play(),
    pause: () => el.pause(),
    seek: (time) => el.seek(time ?? 0)
  };
  const obey = (command: string, time?: number) => {
    const run = () => commands[command](time);
    if (!ready) {
      pending = run;
      return;
    }
    run();
  };
  addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === cfg.linkMessage && e.source === el.iframeElement?.contentWindow) {
      openLink(e.data.url);
      return;
    }
    const m = read(e.data, cfg.hostMessage);
    if (!m) {
      return;
    }
    if (m.links) {
      hostLinks = true;
    }
    if (m.reducedMotion !== undefined) {
      still = m.reducedMotion;
    }
    if (m.fit) {
      scaleBy = scaleOf(m.fit);
      layout();
    }
    if (m.pointer) {
      values[cfg.keys.x] = m.pointer.x;
      values[cfg.keys.y] = m.pointer.y;
      values[cfg.keys.down] = m.pointer.down ? 1 : 0;
      values[cfg.keys.hover] = 1;
    }
    if (m.tilt) {
      values[cfg.keys.tiltX] = m.tilt.x;
      values[cfg.keys.tiltY] = m.tilt.y;
    }
    if (m.command) {
      obey(m.command, m.time);
    }
    standalone?.cancel();
    if (m.gesture && cfg.playback === cfg.modes.scrub && !swiping) {
      swiping = true;
      swipe(pad, window, cfg.scrollLength, scrub);
    }
    if (m.progress !== undefined) {
      scrub(m.progress);
    }
    if (cfg.playback === cfg.modes.inView && m.visible !== undefined) {
      (m.visible ? play : pause)();
    }
  });

  el.addEventListener('play', () => (playing = true));
  el.addEventListener('pause', () => (playing = false));
  el.addEventListener('timeupdate', (e) => emit(cfg.events.TimeUpdate, { time: (e as CustomEvent<{ currentTime: number }>).detail.currentTime, duration: cfg.duration }));
  el.addEventListener('playbackerror', (e) => emit(cfg.events.Error, { message: String((e as CustomEvent<{ error?: { message?: string } }>).detail?.error?.message ?? 'playback failed') }));
  el.addEventListener('ended', () => {
    playing = false;
    emit(cfg.events.Ended);
    if (cfg.loop && cfg.playback !== cfg.modes.scrub) {
      el.seek(0);
      play();
    }
  });
  el.addEventListener('ready', () => {
    ready = true;
    if (progress !== undefined) {
      scrub(progress);
    }
    if (cfg.playback === cfg.modes.autoplay && !still) {
      play();
    }
    pending?.();
    pending = null;
    emit(cfg.events.Ready, { width: cfg.width, height: cfg.height, duration: cfg.duration, playback: cfg.playback, loop: cfg.loop });
  });
  new IntersectionObserver((entries) => {
    if (cfg.playback === cfg.modes.inView) {
      (entries[0].isIntersecting ? play : pause)();
    }
  }).observe(pad);

  const tick = () => {
    values[cfg.keys.time] = (performance.now() - started) / 1000;
    post();
    requestAnimationFrame(tick);
  };
  el.setAttribute('srcdoc', cfg.html);
  requestAnimationFrame(tick);
}
