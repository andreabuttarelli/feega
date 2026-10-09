'use client';
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { DEFAULT_ORIGIN, Fit, HOST_MESSAGE, HostCommand, PlayerEvent, SCRUB_PLAYBACK, embedSrc, readPlayer, settingsUrl, type EmbedSettings, type HostMessage, type PlayerMessage, type ReadyInfo } from './protocol.js';
import { isVisible, storyProgress, travelProgress, type Span } from './progress.js';

export type FeegaMotionProps = {
  id: string;
  fit?: `${Fit}`;
  scrollLength?: number;
  scrollContainer?: RefObject<HTMLElement | null>;
  origin?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onReady?: (info: ReadyInfo) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onEnded?: () => void;
  onLinkClick?: (url: string) => void;
  onError?: (message: string) => void;
};

export type FeegaMotionHandle = { play: () => void; pause: () => void; seek: (seconds: number) => void };

type Callbacks = Pick<FeegaMotionProps, 'onReady' | 'onTimeUpdate' | 'onEnded' | 'onLinkClick' | 'onError'>;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' };

const HANDLERS: { [E in PlayerEvent]: (m: Extract<PlayerMessage, { event: E }>, cb: Callbacks) => void } = {
  [PlayerEvent.Size]: () => undefined,
  [PlayerEvent.Ready]: ({ width, height, duration, playback, loop }, cb) => cb.onReady?.({ width, height, duration, playback, loop }),
  [PlayerEvent.TimeUpdate]: (m, cb) => cb.onTimeUpdate?.(m.time, m.duration),
  [PlayerEvent.Ended]: (_m, cb) => cb.onEnded?.(),
  [PlayerEvent.Link]: (m, cb) => cb.onLinkClick?.(m.url),
  [PlayerEvent.Error]: (m, cb) => cb.onError?.(m.message)
};

const spanOf = (el: Element): Span => {
  const r = el.getBoundingClientRect();
  return { top: r.top, height: r.height };
};

export const FeegaMotion = forwardRef<FeegaMotionHandle, FeegaMotionProps>(function FeegaMotion(props, ref) {
  const { id, fit = Fit.Cover, scrollLength, scrollContainer, origin = DEFAULT_ORIGIN, title = 'Interactive video', className, style } = props;
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef<Callbacks>(props);
  const [settings, setSettings] = useState<EmbedSettings | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  callbacks.current = props;

  const story = scrollLength ?? (settings?.playback === SCRUB_PLAYBACK ? settings.scrollLength : 0);

  const post = useCallback((message: Omit<HostMessage, 'type'>) => frame.current?.contentWindow?.postMessage({ type: HOST_MESSAGE, ...message }, '*'), []);

  useImperativeHandle(ref, () => ({
    play: () => post({ command: HostCommand.Play }),
    pause: () => post({ command: HostCommand.Pause }),
    seek: (seconds) => post({ command: HostCommand.Seek, time: seconds })
  }), [post]);

  useEffect(() => {
    if (scrollLength !== undefined) {
      return;
    }
    let live = true;
    fetch(settingsUrl(origin, id))
      .then((r) => (r.ok ? r.json() : null))
      .then((s: EmbedSettings | null) => live && setSettings(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [origin, id, scrollLength]);

  useEffect(() => {
    const scroller = scrollContainer?.current ?? null;
    const target: HTMLElement | Window = scroller ?? window;
    const viewport = (): Span => (scroller ? spanOf(scroller) : { top: 0, height: window.innerHeight });

    const measure = () => {
      const el = box.current;
      if (!el) {
        return;
      }
      const view = viewport();
      const own = spanOf(el);
      const progress = story > 0 ? storyProgress(own, view.height, view) : travelProgress(own, view);
      post({ progress, visible: isVisible(own, view) });
    };
    const resize = () => {
      setViewportHeight(viewport().height);
      measure();
    };
    const greet = () => {
      post({ reducedMotion: window.matchMedia(REDUCED_MOTION).matches, ...(callbacks.current.onLinkClick ? { links: 'host' as const } : {}) });
      measure();
    };
    const hear = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) {
        return;
      }
      const m = readPlayer(e.data);
      if (!m) {
        return;
      }
      if (m.event === PlayerEvent.Size) {
        greet();
      }
      (HANDLERS[m.event] as (m: PlayerMessage, cb: Callbacks) => void)(m, callbacks.current);
    };

    setViewportHeight(viewport().height);
    target.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('message', hear);
    frame.current?.addEventListener('load', greet);
    return () => {
      target.removeEventListener('scroll', measure);
      window.removeEventListener('resize', resize);
      window.removeEventListener('message', hear);
      frame.current?.removeEventListener('load', greet);
    };
  }, [scrollContainer, story, post]);

  const storyHeight = story > 0 && viewportHeight > 0 ? `${story * viewportHeight}px` : '100%';
  const stageStyle: CSSProperties = story > 0 ? { position: 'sticky', top: 0, width: '100%', height: viewportHeight || '100vh', overflow: 'hidden' } : { position: 'absolute', inset: 0 };

  return createElement(
    'div',
    { ref: box, className, style: { position: 'relative', width: '100%', height: storyHeight, ...style } },
    createElement(
      'div',
      { 'data-feega-stage': '', style: stageStyle },
      createElement('iframe', { ref: frame, src: embedSrc(origin, id, fit as Fit), title, allow: 'accelerometer; gyroscope', style: FILL })
    )
  );
});
