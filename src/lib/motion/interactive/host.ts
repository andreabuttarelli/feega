export const HOST_MESSAGE = 'feega:host';
export const EMBED_ROUTE = '/e';

export type HostReading = { progress?: number; visible?: boolean };

export function hostMain(frame: HTMLIFrameElement, type: string, win: Window): void {
  const wrapper = frame.closest('[data-scroll]') as HTMLElement | null;
  const viewports = Number(wrapper?.getAttribute('data-scroll'));
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  if (wrapper && viewports > 0) {
    wrapper.style.height = `${viewports * 100}vh`;
    frame.style.position = 'sticky';
    frame.style.top = '0';
  }

  const progress = () => {
    const r = frame.getBoundingClientRect();
    if (!wrapper) {
      return clamp((win.innerHeight - r.top) / (win.innerHeight + r.height));
    }
    const w = wrapper.getBoundingClientRect();
    return clamp(-w.top / Math.max(1, w.height - r.height));
  };

  const send = () => {
    const page = Math.max(1, win.document.documentElement.scrollHeight - win.innerHeight);
    const r = frame.getBoundingClientRect();
    frame.contentWindow?.postMessage({ type, progress: progress(), scroll: clamp(win.scrollY / page), visible: r.bottom > 0 && r.top < win.innerHeight }, '*');
  };

  win.addEventListener('scroll', send, { passive: true });
  win.addEventListener('resize', send);
  frame.addEventListener('load', send);
}

export function readHost(data: unknown, type: string): HostReading | null {
  const m = data as { type?: string; progress?: number; scroll?: number; visible?: boolean } | null;
  if (m?.type !== type) {
    return null;
  }
  const progress = typeof m.progress === 'number' ? m.progress : m.scroll;
  return { progress: typeof progress === 'number' ? progress : undefined, visible: typeof m.visible === 'boolean' ? m.visible : undefined };
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
