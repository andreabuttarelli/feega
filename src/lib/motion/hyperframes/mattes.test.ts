import { describe, expect, it } from 'vitest';
import { Matte } from '../mask';
import { MATTE_DRAFT_SCALE, MATTE_SETTLE_MS, matteScript } from './mattes';

const FRAME = { width: 1920, height: 1080 };
const tick = () => new Promise((r) => setTimeout(r, 0));

function page() {
  const widths: number[] = [];
  const listeners = new Map<string, (e: unknown) => void>();
  const timers: (() => void)[] = [];
  const updates: (() => void)[] = [];
  const canvas = (w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined }),
    toDataURL: () => 'data:,'
  });
  let playing = false;
  const win: Record<string, unknown> = {
    __player: { isPlaying: () => playing },
    __timelines: { main: { to: (_t: object, vars: { onUpdate: () => void }) => updates.push(vars.onUpdate) } },
    htmlToImage: {
      getFontEmbedCSS: async () => '',
      toCanvas: async (_node: unknown, o: { canvasWidth: number; canvasHeight: number }) => {
        widths.push(o.canvasWidth);
        return canvas(o.canvasWidth, o.canvasHeight);
      }
    }
  };
  const document = { getElementById: () => ({ style: { setProperty: () => undefined } }), querySelector: () => ({ offsetWidth: FRAME.width, offsetHeight: FRAME.height }) };
  class Image {
    src = '';
    decode = async () => undefined;
  }
  const script = matteScript([{ target: 't', source: 's', matte: Matte.Alpha }], 4).replace(/^<script>|<\/script>$/g, '');
  new Function('window', 'document', 'addEventListener', 'removeEventListener', 'getComputedStyle', 'Image', 'setTimeout', 'clearTimeout', script)(
    win,
    document,
    (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
    () => undefined,
    () => ({ display: 'block', visibility: 'visible' }),
    Image,
    (fn: () => void) => timers.push(fn),
    () => undefined
  );
  const seek = async () => {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get('hf-seek')!({ detail: { waitUntil: (p: Promise<unknown>) => (work = p) } });
    await work;
  };
  const play = async () => {
    playing = true;
    listeners.get('hf-seek')!({ detail: { waitUntil: () => undefined } });
    updates.forEach((u) => u());
    await tick();
    await tick();
  };
  const pause = () => {
    playing = false;
  };
  const settle = async () => {
    timers.splice(0).forEach((t) => t());
    await tick();
    await tick();
  };
  return { widths, seek, play, pause, settle };
}

describe('matte quality while the preview plays', () => {
  it('a seek while paused renders the matte at full size: export and render wait for it', async () => {
    const p = page();
    await p.seek();

    expect(p.widths.at(-1)).toBe(FRAME.width);
  });

  it('the player seeking while it plays gets a draft at reduced size, so the matte keeps up', async () => {
    const p = page();
    await p.seek();
    await p.play();

    expect(p.widths.at(-1)).toBe(FRAME.width * MATTE_DRAFT_SCALE);
  });

  it('once playback stops the matte settles back to full size', async () => {
    const p = page();
    await p.play();
    p.pause();
    await p.settle();

    expect(p.widths.at(-1)).toBe(FRAME.width);
    expect(MATTE_SETTLE_MS).toBeGreaterThan(0);
  });
});
