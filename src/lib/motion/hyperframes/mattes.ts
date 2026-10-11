import { MATTE_READ, matteAlpha, type MattePair } from '../matte';
import { css, js } from './html';
import { MaskScope } from './masks';

export const MATTE_RUNTIME = '__feegaMattes';
export const MATTE_DRAFT_SCALE = 0.25;
export const MATTE_SETTLE_MS = 150;

enum Pass {
  Draft = 0,
  Exact = 1
}

const PASS_SCALE: Record<Pass, number> = { [Pass.Draft]: MATTE_DRAFT_SCALE, [Pass.Exact]: 1 };

const WRAPPER = `k${MaskScope.Matte}`;
const EMPTY = 'linear-gradient(#0000,#0000)';
const WHOLE = 'linear-gradient(#000,#000)';

export function matteWrapper(pair: MattePair, inner: string): string {
  const hidden = matteAlpha(MATTE_READ[pair.matte], 0, 0, 0, 0) === 0;
  const style = hidden ? ` style="${css({ mask: EMPTY, WebkitMask: EMPTY })}"` : '';
  return `<div class="${WRAPPER}" id="${WRAPPER}-${pair.target}"${style}>${inner}</div>`;
}

type RuntimeConfig = { pairs: MattePair[]; reads: typeof MATTE_READ; whole: string; lib: string; wrapper: string; global: string; scales: Record<Pass, number>; settleMs: number; exact: Pass; draft: Pass };
type HtmlToImage = {
  toCanvas: (node: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  toSvg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string>;
  getFontEmbedCSS: (node: HTMLElement) => Promise<string>;
};
type SeekDetail = { waitUntil?: (work: Promise<unknown>) => void };

function matteRuntime(cfg: RuntimeConfig, tl: { to: (target: object, vars: Record<string, unknown>, at: number) => void } | undefined, duration: number) {
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

  const snapshot = async (source: HTMLElement, id: string, pass: Pass) => {
    const width = source.offsetWidth;
    const height = source.offsetHeight;
    const scale = cfg.scales[pass];
    const canvasWidth = Math.round(width * scale);
    const canvasHeight = Math.round(height * scale);
    if (!drawn(source)) {
      return blank(canvasWidth, canvasHeight).toDataURL('image/png');
    }
    const options = { width, height, pixelRatio: 1, fontEmbedCSS: await embed(id, source), filter: drawable, style: { opacity: '1' } };
    if (pass === cfg.exact) {
      return tool().toSvg(source, options);
    }
    return (await tool().toCanvas(source, { ...options, canvasWidth, canvasHeight })).toDataURL('image/png');
  };

  const paint = async (pair: MattePair, pass: Pass) => {
    const target = document.getElementById(`${cfg.wrapper}-${pair.target}`);
    const source = document.querySelector<HTMLElement>(`[data-clip="${pair.source}"]`);
    if (!target || !source) {
      return;
    }

    const url = await snapshot(source, pair.source, pass);
    const picture = new Image();
    picture.src = url;
    await picture.decode().catch(() => undefined);
    const read = cfg.reads[pair.matte];
    const layer = `url("${url}") 0 0 / 100% 100% no-repeat ${read.weights ? 'luminance' : 'alpha'}`;
    target.style.setProperty('mask', read.invert ? `${layer}, ${cfg.whole}` : layer);
    target.style.setProperty('mask-composite', read.invert ? 'exclude' : 'add');
  };

  let running: Promise<void> | null = null;
  let wanted: Pass | null = null;
  let settle: ReturnType<typeof setTimeout> | null = null;
  const refresh = (pass: Pass): Promise<void> => {
    wanted = Math.max(wanted ?? pass, pass);
    if (running) {
      return running;
    }
    running = (async () => {
      await ((win.__fontsReady as Promise<unknown> | undefined) ?? Promise.resolve());
      await load();
      const virtual = win.__HF_VIRTUAL_TIME__ as { originalRequestAnimationFrame?: typeof requestAnimationFrame } | undefined;
      const paced = window.requestAnimationFrame;
      window.requestAnimationFrame = virtual?.originalRequestAnimationFrame ?? paced;
      try {
        while (wanted !== null) {
          await Promise.resolve();
          const pass = wanted;
          wanted = null;
          for (const pair of cfg.pairs) {
            await paint(pair, pass);
          }
        }
      } finally {
        window.requestAnimationFrame = paced;
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };

  const player = () => win.__player as { isPlaying?: () => boolean } | undefined;
  const settleLater = () => {
    if (settle) {
      clearTimeout(settle);
    }
    settle = setTimeout(() => void refresh(cfg.exact), cfg.settleMs);
  };
  const onSeek = (e: Event) => {
    if (!player()?.isPlaying?.()) {
      (e as CustomEvent<SeekDetail>).detail?.waitUntil?.(refresh(cfg.exact));
      return;
    }
    void refresh(cfg.draft);
    settleLater();
  };
  const onPlay = () => {
    if (player()?.isPlaying?.()) {
      void refresh(cfg.draft);
      settleLater();
    }
  };
  const previous = win[cfg.global] as { stop?: () => void } | undefined;
  previous?.stop?.();
  win[cfg.global] = Object.assign(() => refresh(cfg.exact), { stop: () => removeEventListener('hf-seek', onSeek) });
  addEventListener('hf-seek', onSeek);
  tl?.to({}, { duration, ease: 'none', onUpdate: onPlay }, 0);
  void refresh(cfg.exact);
}

export function matteScript(pairs: MattePair[], duration: number, lib: string): string {
  if (!pairs.length) {
    return '';
  }
  const cfg: RuntimeConfig = { pairs, reads: MATTE_READ, whole: WHOLE, lib, wrapper: WRAPPER, global: MATTE_RUNTIME, scales: PASS_SCALE, settleMs: MATTE_SETTLE_MS, exact: Pass.Exact, draft: Pass.Draft };
  return `<script>(${matteRuntime.toString()})(${js(cfg)},window.__timelines&&window.__timelines.main,${duration});</script>`;
}
