export const HOST_MESSAGE = 'feega:host';
export const EMBED_ROUTE = '/e';

export type HostReading = { progress?: number; visible?: boolean; gesture?: boolean };

export function hostMain(frame: HTMLIFrameElement, type: string, win: Window, anchor: Element = frame): void {
  const wrapper = frame.closest('[data-scroll]') as HTMLElement | null;
  const viewports = Number(wrapper?.getAttribute('data-scroll'));
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  if (wrapper && viewports > 0) {
    wrapper.style.height = `${viewports * 100}vh`;
    frame.style.position = 'sticky';
    frame.style.top = '0';
  }

  const progress = () => {
    const r = anchor.getBoundingClientRect();
    if (!wrapper) {
      return clamp((win.innerHeight - r.top) / (win.innerHeight + r.height));
    }
    const w = wrapper.getBoundingClientRect();
    return clamp(-w.top / Math.max(1, w.height - r.height));
  };

  const send = () => {
    const page = Math.max(1, win.document.documentElement.scrollHeight - win.innerHeight);
    const r = anchor.getBoundingClientRect();
    frame.contentWindow?.postMessage({ type, progress: progress(), scroll: clamp(win.scrollY / page), visible: r.bottom > 0 && r.top < win.innerHeight }, '*');
  };

  win.addEventListener('scroll', send, { passive: true });
  win.addEventListener('resize', send);
  frame.addEventListener('load', send);
  send();
}

export function readHost(data: unknown, type: string): HostReading | null {
  const m = data as { type?: string; progress?: number; scroll?: number; visible?: boolean; gesture?: boolean } | null;
  if (m?.type !== type) {
    return null;
  }
  const progress = typeof m.progress === 'number' ? m.progress : m.scroll;
  const reading: HostReading = { progress: typeof progress === 'number' ? progress : undefined, visible: typeof m.visible === 'boolean' ? m.visible : undefined };
  if (m.gesture === true) {
    reading.gesture = true;
  }
  return reading;
}

export function gestureScrub(pad: HTMLElement, win: Window, travel: number, onProgress: (p: number) => void): void {
  const FRICTION = 0.92;
  const EASE = 0.2;
  const REST = 0.0005;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const span = () => Math.max(1, pad.clientHeight * travel);
  let target = 0;
  let shown = 0;
  let velocity = 0;
  let lastY: number | null = null;
  let running = false;

  const step = () => {
    target = clamp(target + velocity);
    velocity *= FRICTION;
    shown += (target - shown) * EASE;
    onProgress(shown);
    if (Math.abs(target - shown) > REST || Math.abs(velocity) > REST) {
      win.requestAnimationFrame(step);
      return;
    }
    running = false;
  };
  const kick = () => {
    if (running) {
      return;
    }
    running = true;
    win.requestAnimationFrame(step);
  };

  pad.style.touchAction = 'none';
  pad.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const next = clamp(target + e.deltaY / span());
      if (next === target) {
        return;
      }
      e.preventDefault();
      target = next;
      velocity = 0;
      kick();
    },
    { passive: false }
  );
  pad.addEventListener('pointerdown', (e: PointerEvent) => {
    lastY = e.clientY;
    velocity = 0;
  });
  pad.addEventListener('pointermove', (e: PointerEvent) => {
    if (lastY === null) {
      return;
    }
    const moved = (lastY - e.clientY) / span();
    lastY = e.clientY;
    target = clamp(target + moved);
    velocity = moved;
    kick();
  });
  const release = () => {
    lastY = null;
    kick();
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
}

export function selfScroll(win: Window, waitMs: number, className: string, onProgress: (p: number) => void): { cancel: () => void } {
  const root = win.document.documentElement;
  const scrolled = () => onProgress(Math.min(1, Math.max(0, win.scrollY / Math.max(1, root.scrollHeight - win.innerHeight))));
  let on = false;

  const timer = win.setTimeout(() => {
    on = true;
    root.classList.add(className);
    win.addEventListener('scroll', scrolled, { passive: true });
    scrolled();
  }, waitMs);

  const cancel = () => {
    win.clearTimeout(timer);
    if (!on) {
      return;
    }
    on = false;
    root.classList.remove(className);
    win.removeEventListener('scroll', scrolled);
    win.scrollTo(0, 0);
  };
  return { cancel };
}
