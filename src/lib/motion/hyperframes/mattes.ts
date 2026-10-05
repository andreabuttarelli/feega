import { MATTE_READ, matteAlpha, type MattePair } from '../matte';
import { css, js } from './html';
import { SCREENSHOT_URL } from './capture';
import { MaskScope } from './masks';

export const MATTE_RUNTIME = '__feegaMattes';

const WRAPPER = `k${MaskScope.Matte}`;
const EMPTY = 'linear-gradient(#0000,#0000)';

export function matteWrapper(pair: MattePair, inner: string): string {
  const hidden = matteAlpha(MATTE_READ[pair.matte], 0, 0, 0, 0) === 0;
  const style = hidden ? ` style="${css({ mask: EMPTY, WebkitMask: EMPTY })}"` : '';
  return `<div class="${WRAPPER}" id="${WRAPPER}-${pair.target}"${style}>${inner}</div>`;
}

type RuntimeConfig = { pairs: MattePair[]; reads: typeof MATTE_READ; lib: string; wrapper: string; global: string };
type HtmlToImage = {
  toCanvas: (node: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};
type SeekDetail = { waitUntil?: (work: Promise<unknown>) => void };

function matteRuntime(cfg: RuntimeConfig, alphaOf: typeof matteAlpha, tl: { to: (target: object, vars: Record<string, unknown>, at: number) => void } | undefined, duration: number) {
  const win = window as unknown as Record<string, unknown>;
  const tool = () => win.htmlToImage as HtmlToImage;
  let lib: Promise<unknown> | null = null;
  const fonts = new Map<string, Promise<string>>();

  const load = () =>
    (lib ??= tool()
      ? Promise.resolve()
      : new Promise((ok, ko) => {
          const s = document.createElement('script');
          s.src = cfg.lib;
          s.onload = ok;
          s.onerror = ko;
          document.head.appendChild(s);
        }));
  const drawable = (node: Node) => !(node instanceof HTMLVideoElement) || (node.readyState >= 2 && node.videoWidth > 0);
  const drawn = (el: HTMLElement) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const embed = (id: string, el: HTMLElement) => {
    if (!fonts.has(id)) {
      fonts.set(id, tool().getFontEmbedCSS(el).catch(() => ''));
    }
    return fonts.get(id)!;
  };
  const blank = (width: number, height: number) => Object.assign(document.createElement('canvas'), { width, height });

  const render = async (source: HTMLElement, id: string, width: number, height: number) => {
    if (!drawn(source)) {
      return blank(width, height);
    }
    const options = { width, height, canvasWidth: width, canvasHeight: height, pixelRatio: 1, fontEmbedCSS: await embed(id, source), filter: drawable, style: { opacity: '1' } };
    return tool().toCanvas(source, options);
  };

  const paint = async (pair: MattePair) => {
    const target = document.getElementById(`${cfg.wrapper}-${pair.target}`);
    const source = document.querySelector<HTMLElement>(`[data-clip="${pair.source}"]`);
    if (!target || !source) {
      return;
    }

    const width = source.offsetWidth;
    const height = source.offsetHeight;
    const canvas = await render(source, pair.source, width, height);
    const read = cfg.reads[pair.matte];
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const pixels = ctx.getImageData(0, 0, width, height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const alpha = alphaOf(read, d[i], d[i + 1], d[i + 2], d[i + 3]);
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = alpha;
    }
    ctx.putImageData(pixels, 0, 0);

    const url = canvas.toDataURL('image/png');
    const picture = new Image();
    picture.src = url;
    await picture.decode().catch(() => undefined);
    const value = `url("${url}") 0 0 / 100% 100% no-repeat`;
    target.style.setProperty('mask', value);
    target.style.setProperty('-webkit-mask', value);
  };

  let running: Promise<void> | null = null;
  let again = false;
  const refresh = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      await ((win.__fontsReady as Promise<unknown> | undefined) ?? Promise.resolve());
      await load();
      const virtual = win.__HF_VIRTUAL_TIME__ as { originalRequestAnimationFrame?: typeof requestAnimationFrame } | undefined;
      const paced = window.requestAnimationFrame;
      window.requestAnimationFrame = virtual?.originalRequestAnimationFrame ?? paced;
      try {
        do {
          again = false;
          await Promise.resolve();
          for (const pair of cfg.pairs) {
            await paint(pair);
          }
        } while (again);
      } finally {
        window.requestAnimationFrame = paced;
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };

  win[cfg.global] = refresh;
  addEventListener('hf-seek', (e) => (e as CustomEvent<SeekDetail>).detail?.waitUntil?.(refresh()));
  tl?.to({}, { duration, ease: 'none', onUpdate: () => void refresh() }, 0);
  void refresh();
}

export function matteScript(pairs: MattePair[], duration: number): string {
  if (!pairs.length) {
    return '';
  }
  const cfg: RuntimeConfig = { pairs, reads: MATTE_READ, lib: SCREENSHOT_URL, wrapper: WRAPPER, global: MATTE_RUNTIME };
  return `<script>(${matteRuntime.toString()})(${js(cfg)},(${matteAlpha.toString()}),window.__timelines&&window.__timelines.main,${duration});</script>`;
}
