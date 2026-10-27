import type { VideoFrames } from '@feega/motion-core/motion/gpu-full/video-frames';

export enum ProxyMode {
  Original,
  Proxy
}

export const PROXY_PARAM = 'proxy';

const CANVAS_ASSET = /^\/p\/[^/?#]+\/c\/[^/?#]+\/assets\/[^/?#]+(\?.*)?$/;

export function playbackSrc(src: string, mode: ProxyMode): string {
  if (mode === ProxyMode.Original || !CANVAS_ASSET.test(src)) {
    return src;
  }

  return `${src}${src.includes('?') ? '&' : '?'}${PROXY_PARAM}=1`;
}

export function proxying(inner: VideoFrames, mode: () => ProxyMode): VideoFrames {
  const through = (src: string) => playbackSrc(src, mode());

  return {
    ...inner,
    has: (src, t) => inner.has(through(src), t),
    at: (src, t, width) => inner.at(through(src), t, width),
    cached: (src) => inner.cached(through(src)),
    forget: (src) => inner.forget(through(src))
  };
}
