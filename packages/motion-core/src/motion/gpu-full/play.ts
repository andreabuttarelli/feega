import type { BrandTokens } from '../brand';
import type { MotionDoc } from '../doc';
import { drawFrame, prepare, type DisplayList, type Prepared } from './display-list';
import { frameAt } from './frame';
import { hitClip, linkAt, type Point } from './hit';
import { liveFeed, type LiveFeed, type LiveInputs } from '../interactive/gpu-live';
import { NO_TYPESET, smoothingOf, type Typeset } from './text/painter';
import { faceEngineOf, loadFontsWith } from './text/engines';
import type { Raster } from './raster';
import { BACKENDS, type FullBackend } from './backends';
import { createMedia } from './media';
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
  inputs?: () => LiveInputs;
};

export type Player = { show: (shown: Shown) => void; dispose: () => void; linkAt: (point: Point) => string | null; clipAt: (point: Point) => string | null };

type Reads = { of: Prepared; custom: Promise<CustomReads>; feed: LiveFeed | null };

type Drawn = { prepared: Prepared; frame: number; list: DisplayList };

const MAX_STEP_SECONDS = 0.1;
const MS_PER_SECOND = 1000;

export function mountPlayer(mount: PlayerMount): Player {
  const { canvas, host, backend, size, time, onfallback } = mount;
  const loadFonts = loadFontsWith(faceEngineOf(mount.faces ?? null));
  const media = createMedia();
  let shown: Shown | null = null;
  let typeset: Typeset = NO_TYPESET;
  let reads: Reads | null = null;
  let raster: Raster | null = null;
  let gone = false;
  let drawn: [Prepared | null, number] = [null, -1];
  let last: Drawn | null = null;
  let clock = performance.now();
  let busy = false;
  let fontsFor: Shown | null = null;

  function remount() {
    if (!shown) {
      return;
    }
    const of = prepare(shown.doc, shown.tokens, shown.assets, typeset);
    const previous = reads;
    reads = { of, custom: mountCustomReads(host, shown.compose, of), feed: mount.inputs ? liveFeed(shown) : null };
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
    const stamp = performance.now();
    const step = Math.min(MAX_STEP_SECONDS, (stamp - clock) / MS_PER_SECOND);
    clock = stamp;
    const frame = frameAt(time(), current.of.doc.fps, current.of.doc.durationInFrames);
    const now = current.feed && mount.inputs ? current.feed.apply(current.of, frame, mount.inputs(), step) : current.of;
    if (drawn[0] === now && drawn[1] === frame) {
      return;
    }
    drawn = [now, frame];
    busy = true;
    void current.custom
      .then((r) => r.readAt(frame))
      .then(async (read) => {
        const list = drawFrame(now, frame, read.reads);
        last = { prepared: now, frame, list };
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
    linkAt: (point) => (last ? linkAt(last.prepared, last.frame, last.list, point) : null),
    clipAt: (point) => (last ? hitClip(last.list, point) : null),
    dispose() {
      cancelAnimationFrame(loop);
      gone = true;
      raster?.dispose();
      media.dispose();
      void reads?.custom.then((r) => r.dispose(), () => {});
    }
  };
}
