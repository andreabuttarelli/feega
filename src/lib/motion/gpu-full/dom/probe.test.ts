// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { domProbe } from './probe';
import { CUSTOM_ROOT_PREFIX, DOM_READ_REPLY, DOM_READ_REQUEST, NO_INDEX, READ_ATTRS, READ_STYLES, TEXT_PAD } from './tree';

const CLIP = 'poster';
const CONFIG = { request: DOM_READ_REQUEST, reply: DOM_READ_REPLY, timeline: 'main', prefix: CUSTOM_ROOT_PREFIX, none: NO_INDEX, pad: TEXT_PAD, styles: READ_STYLES, attrs: READ_ATTRS };

type Reply = { type: string; id: string; trees: Record<string, unknown>; error?: string };

function asked(body: string, beside = ''): Promise<{ reply: Reply; frames: number }> {
  document.body.innerHTML = `<div id="${CUSTOM_ROOT_PREFIX}${CLIP}">${body}</div>${beside}`;
  let frames = 0;
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
    frames += 1;
    setTimeout(run, 0);
    return frames;
  });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1 }));
  Object.defineProperty(document, 'fonts', { configurable: true, value: Object.assign([], { ready: Promise.resolve() }) });
  return new Promise((resolve) => {
    const source = { postMessage: (reply: Reply) => resolve({ reply, frames }) } as unknown as Window;
    window.dispatchEvent(new MessageEvent('message', { data: { type: DOM_READ_REQUEST, id: 'a', time: 0, clips: [CLIP] }, source }));
  });
}

describe('domProbe', () => {
  beforeAll(() => domProbe(CONFIG));
  afterEach(() => vi.unstubAllGlobals());

  it('answers a page of plain elements without waiting for an animation frame', async () => {
    const { reply, frames } = await asked('<div></div>');

    expect(reply.error).toBeUndefined();
    expect(Object.keys(reply.trees)).toEqual([CLIP]);
    expect(frames).toBe(0);
  });

  it('does not wait for a canvas the read clips do not contain', async () => {
    const { frames } = await asked('<div></div>', '<canvas></canvas>');

    expect(frames).toBe(0);
  });

  it('gives a clip with a canvas one animation frame to paint it', async () => {
    const { reply, frames } = await asked('<canvas></canvas>');

    expect(reply.error).toBeUndefined();
    expect(frames).toBe(1);
  });
});
