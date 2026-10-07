import { describe, expect, it } from 'vitest';
import { Matte } from '../mask';
import { MATTE_DRAFT_SCALE, MATTE_SETTLE_MS, matteScript } from './mattes';

const FRAME = { width: 1920, height: 1080 };
const VECTOR = 'data:image/svg+xml;charset=utf-8,matte';
const tick = () => new Promise((r) => setTimeout(r, 0));

function page(matte: Exclude<Matte, Matte.None> = Matte.Alpha) {
  const widths: number[] = [];
  const vectors: number[] = [];
  const styles = new Map<string, string>();
  let pixelReads = 0;
  const listeners = new Map<string, (e: unknown) => void>();
  const timers: (() => void)[] = [];
  const updates: (() => void)[] = [];
  const canvas = (w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => ({
      getImageData: () => {
        pixelReads += 1;
        return { data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData: () => undefined
    }),
    toDataURL: () => 'data:,'
  });
  let playing = false;
  const win: Record<string, unknown> = {
    __player: { isPlaying: () => playing },
    __timelines: { main: { to: (_t: object, vars: { onUpdate: () => void }) => updates.push(vars.onUpdate) } },
    htmlToImage: {
      getFontEmbedCSS: async () => '',
      toSvg: async (_node: unknown, o: { width: number }) => {
        vectors.push(o.width);
        return VECTOR;
      },
      toCanvas: async (_node: unknown, o: { canvasWidth: number; canvasHeight: number }) => {
        widths.push(o.canvasWidth);
        return canvas(o.canvasWidth, o.canvasHeight);
      }
    }
  };
  const document = { getElementById: () => ({ style: { setProperty: (k: string, v: string) => styles.set(k, v) } }), querySelector: () => ({ offsetWidth: FRAME.width, offsetHeight: FRAME.height }) };
  class Image {
    src = '';
    decode = async () => undefined;
  }
  const script = matteScript([{ target: 't', source: 's', matte }], 4).replace(/^<script>|<\/script>$/g, '');
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
  return { widths, vectors, seek, play, pause, settle, styles, reads: () => pixelReads };
}

describe('matte quality while the preview plays', () => {
  it('a seek while paused masks with the vector picture at full size, never a raster to encode', async () => {
    const p = page();
    await p.seek();

    expect(p.vectors).toEqual([FRAME.width]);
    expect(p.widths).toEqual([]);
    expect(p.styles.get('mask')).toContain(VECTOR);
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

    expect(p.vectors.at(-1)).toBe(FRAME.width);
    expect(MATTE_SETTLE_MS).toBeGreaterThan(0);
  });
});

describe('a matte is a mask of the raster as drawn', () => {
  it.each([
    [Matte.Alpha, 'alpha', false],
    [Matte.AlphaInverted, 'alpha', true],
    [Matte.Luma, 'luminance', false],
    [Matte.LumaInverted, 'luminance', true]
  ] as const)('%s reads the raster by its %s, inverted=%s, without a pass over its pixels', async (matte, mode, inverted) => {
    const p = page(matte);
    await p.seek();

    expect(p.styles.get('mask')).toContain(` ${mode}`);
    expect(p.styles.get('mask')!.includes('linear-gradient')).toBe(inverted);
    expect(p.styles.get('mask-composite')).toBe(inverted ? 'exclude' : 'add');
    expect(p.reads()).toBe(0);
  });
});
