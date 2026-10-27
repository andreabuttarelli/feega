import type { BrandTokens } from '../brand';
import type { MotionDoc } from '../doc';
import { drawFrame, prepare, type Prepared } from './display-list';
import { NO_TYPESET, smoothingOf, type Typeset } from './text/painter';
import { faceEngineOf, loadFontsWith } from './text/engines';
import type { Raster } from './raster';
import { BACKENDS, type FullBackend } from './backends';
import { createMedia } from './media';
import type { VideoFrames } from './video-frames';
import { mountCustomReads, type CustomReads } from './dom/custom';
import type { Compose } from './dom/reader';

export type Shown = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; compose: Compose };

export type PlayerMount = {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  backend: FullBackend;
  size: { width: number; height: number };
  time: () => number;
  faces?: string | null;
  onfallback: (reason: unknown) => void;
  ongaps?: (gaps: number) => void;
  frames?: VideoFrames;
};

export type Player = { show: (shown: Shown) => void; dispose: () => void };

type Reads = { of: Prepared; custom: Promise<CustomReads> };

export function mountPlayer(mount: PlayerMount): Player {
  const { canvas, host, backend, size, time, onfallback } = mount;
  const loadFonts = loadFontsWith(faceEngineOf(mount.faces ?? null));
  const media = createMedia({ frames: mount.frames });
  let shown: Shown | null = null;
  let typeset: Typeset = NO_TYPESET;
  let reads: Reads | null = null;
  let raster: Raster | null = null;
  let gone = false;
  let drawn: [Prepared | null, number] = [null, -1];
  let busy = false;
  let fontsFor: Shown | null = null;

  function remount() {
    if (!shown) {
      return;
    }
    const of = prepare(shown.doc, shown.tokens, shown.assets, typeset);
    const previous = reads;
    reads = { of, custom: mountCustomReads(host, shown.compose, of) };
    void previous?.custom.then((r) => r.dispose(), () => {});
  }

  function show(next: Shown) {
    shown = next;
    remount();
    const asked = next;
    fontsFor = asked;
    void loadFonts(asked.doc, asked.assets, asked.tokens).then((fonts) => {
      if (gone || fontsFor !== asked) {
        return;
      }
      typeset = { fonts, smoothing: smoothingOf(navigator.userAgent) };
      remount();
    });
  }

  BACKENDS[backend](canvas, size.width, size.height).then((made) => (gone ? made.dispose() : (raster = made)), onfallback);

  let loop = 0;
  const tick = () => {
    loop = requestAnimationFrame(tick);
    const current = reads;
    const into = raster;
    if (!current || !into || busy) {
      return;
    }
    const now = current.of;
    const frame = Math.round(time() * now.doc.fps);
    if (drawn[0] === now && drawn[1] === frame) {
      return;
    }
    drawn = [now, frame];
    busy = true;
    void current.custom
      .then((r) => r.readAt(frame))
      .then(async (read) => {
        const list = drawFrame(now, frame, read.reads);
        mount.ongaps?.(list.unsupported.length);
        await media.ready(list);
        into.draw(list, (item) => read.picture(item) ?? media.pictures(item));
      })
      .catch(onfallback)
      .finally(() => {
        busy = false;
      });
  };
  loop = requestAnimationFrame(tick);

  return {
    show,
    dispose() {
      cancelAnimationFrame(loop);
      gone = true;
      raster?.dispose();
      media.dispose();
      void reads?.custom.then((r) => r.dispose(), () => {});
    }
  };
}
