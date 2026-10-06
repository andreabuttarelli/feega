export type PlayerConfig = {
  html: string;
  width: number;
  height: number;
  duration: number;
  playback: string;
  loop: boolean;
  modes: { autoplay: string; inView: string; scrub: string };
  inputMessage: string;
  hostMessage: string;
  keys: { x: string; y: string; down: string; hover: string; tiltX: string; tiltY: string; scroll: string; time: string };
};

type PlayerEl = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; iframeElement?: HTMLIFrameElement };
type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

export function playerMain(cfg: PlayerConfig): void {
  const TILT_DEGREES = 45;
  const UPRIGHT_BETA = 45;
  const el = document.getElementById('player') as PlayerEl;
  const pad = document.getElementById('pad') as HTMLElement;
  const values: Record<string, number> = {};
  const started = performance.now();
  let ready = false;
  let playing = false;
  let asked = false;

  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const post = () => el.iframeElement?.contentWindow?.postMessage({ type: cfg.inputMessage, values }, '*');
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
  const content = () => {
    const r = pad.getBoundingClientRect();
    const scale = Math.min(r.width / cfg.width, r.height / cfg.height);
    const w = cfg.width * scale;
    const h = cfg.height * scale;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  };
  const point = (e: PointerEvent) => {
    const box = content();
    values[cfg.keys.x] = (e.clientX - box.left) / box.width;
    values[cfg.keys.y] = (e.clientY - box.top) / box.height;
    values[cfg.keys.hover] = 1;
  };
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
  });
  pad.addEventListener('pointerup', () => {
    values[cfg.keys.down] = 0;
  });
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
  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as { type?: string; scroll?: number; visible?: boolean };
    if (m?.type !== cfg.hostMessage) {
      return;
    }
    if (typeof m.scroll === 'number') {
      values[cfg.keys.scroll] = m.scroll;
      if (cfg.playback === cfg.modes.scrub && ready) {
        el.seek(m.scroll * cfg.duration);
      }
    }
    if (cfg.playback === cfg.modes.inView && typeof m.visible === 'boolean') {
      (m.visible ? play : pause)();
    }
  });

  el.addEventListener('play', () => (playing = true));
  el.addEventListener('pause', () => (playing = false));
  el.addEventListener('ended', () => {
    playing = false;
    if (cfg.loop && cfg.playback !== cfg.modes.scrub) {
      el.seek(0);
      play();
    }
  });
  el.addEventListener('ready', () => {
    ready = true;
    if (cfg.playback === cfg.modes.autoplay) {
      play();
    }
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
