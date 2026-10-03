import { freezeMasks } from './masks';
import { js } from './html';

export const CAPTURE_REQUEST = 'feega:capture';
export const CAPTURE_REPLY = 'feega:frame';
const SCREENSHOT_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
const MEDIA_TIMEOUT_MS = 8000;

export enum FrameFormat {
  Jpeg = 'jpeg',
  Bitmap = 'bitmap'
}

export type CaptureRequest = { type: typeof CAPTURE_REQUEST; id: string; format: FrameFormat; width: number; height: number; quality?: number };
export type CaptureReply = { type: typeof CAPTURE_REPLY; id: string; url?: string; bitmap?: ImageBitmap; error?: string };

type RuntimeConfig = { request: string; reply: string; lib: string; width: number; height: number; mediaTimeoutMs: number };
type Shot = { body: Record<string, unknown>; transfer: Transferable[] };
type HtmlToImage = {
  toJpeg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string>;
  toCanvas: (node: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};

function captureRuntime(cfg: RuntimeConfig, freeze: () => Promise<() => void>) {
  let lib: Promise<unknown> | null = null;
  let fonts: Promise<string> | null = null;
  const tool = () => (window as unknown as { htmlToImage: HtmlToImage }).htmlToImage;

  const load = () =>
    (lib ??= new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = cfg.lib;
      s.onload = ok;
      s.onerror = ko;
      document.head.appendChild(s);
    }));
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const painted = () => frame().then(frame);
  const settled = (v: HTMLVideoElement) => {
    if (!v.seeking && (v.readyState >= 2 || v.offsetParent === null)) {
      return Promise.resolve();
    }
    return new Promise<void>((r) => {
      v.addEventListener('seeked', () => r(), { once: true });
      v.addEventListener('loadeddata', () => r(), { once: true });
      setTimeout(r, cfg.mediaTimeoutMs);
      if (!v.seeking) {
        v.currentTime = v.currentTime;
      }
    });
  };
  const drawable = (node: Node) => !(node instanceof HTMLVideoElement) || (node.offsetParent !== null && node.readyState >= 2 && node.videoWidth > 0);
  const reason = (err: unknown) => {
    const src = (err as Event)?.target instanceof HTMLElement ? ((err as Event).target as HTMLImageElement).src?.slice(0, 80) : '';
    return err instanceof Event ? `a picture or video in this frame could not be drawn${src ? ` (${src})` : ''}` : String(err);
  };
  const mediaReady = () => Promise.all([...document.querySelectorAll('video')].map(settled));

  const size = (m: CaptureRequest, embed: string) => ({ width: cfg.width, height: cfg.height, canvasWidth: m.width, canvasHeight: m.height, pixelRatio: 1, fontEmbedCSS: embed, filter: drawable });
  const output: Record<string, (root: HTMLElement, m: CaptureRequest, embed: string) => Promise<Shot>> = {
    jpeg: (root, m, embed) => tool().toJpeg(root, { ...size(m, embed), quality: m.quality }).then((url) => ({ body: { url }, transfer: [] })),
    bitmap: (root, m, embed) =>
      tool()
        .toCanvas(root, size(m, embed))
        .then((canvas) => createImageBitmap(canvas))
        .then((bitmap) => ({ body: { bitmap }, transfer: [bitmap] }))
  };

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as CaptureRequest;
    if (!m || m.type !== cfg.request) {
      return;
    }
    const source = e.source as Window | null;
    const reply = (body: Record<string, unknown>, transfer: Transferable[]) => source?.postMessage({ type: cfg.reply, id: m.id, ...body }, { targetOrigin: '*', transfer });
    const root = document.getElementById('root') as HTMLElement;

    load()
      .then(() => document.fonts.ready)
      .then(painted)
      .then(mediaReady)
      .then(painted)
      .then(() => (fonts ??= tool().getFontEmbedCSS(root)))
      .then((embed) => freeze().then((thaw) => output[m.format](root, m, embed).finally(thaw)))
      .then(
        (shot) => reply(shot.body, shot.transfer),
        (err) => reply({ error: reason(err) }, [])
      );
  });
}

export function captureScript(doc: { width: number; height: number }): string {
  const cfg: RuntimeConfig = { request: CAPTURE_REQUEST, reply: CAPTURE_REPLY, lib: SCREENSHOT_URL, width: doc.width, height: doc.height, mediaTimeoutMs: MEDIA_TIMEOUT_MS };
  return `<script>(${captureRuntime.toString()})(${js(cfg)},(${freezeMasks.toString()}));</script>`;
}
