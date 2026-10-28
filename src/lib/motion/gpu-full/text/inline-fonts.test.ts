import { describe, expect, it, vi } from 'vitest';
import { bytesOfBase64, base64Of } from '@feega/motion-core/motion/gpu-full/inline-core';
import { inlineReader, recording } from '@feega/motion-core/motion/gpu-full/text/inline-fonts';
import type { Reader } from '@feega/motion-core/motion/gpu-full/text/load';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fira';
const FILE_URL = 'https://fonts.gstatic.com/fira.woff2';
const FONT = new Uint8Array([0, 1, 2, 250, 251, 252, 255]);

const network = (): Reader => ({
  text: vi.fn(async (url: string) => (url === CSS_URL ? '@font-face{}' : '')),
  bytes: vi.fn(async (url: string) => {
    if (url !== FILE_URL) {
      throw new Error('404');
    }
    return FONT;
  })
});

describe('fonts carried inside a downloaded file', () => {
  it('keeps every sheet and font file the loader read, and nothing that failed', async () => {
    const { reader, fonts } = recording(network());

    await reader.text(CSS_URL);
    await reader.bytes(FILE_URL);
    await reader.bytes('https://fonts.gstatic.com/missing.woff2').catch(() => undefined);
    await reader.text('https://fonts.googleapis.com/css2?family=Gone');

    expect(fonts().text).toEqual({ [CSS_URL]: '@font-face{}' });
    expect(Object.keys(fonts().bytes)).toEqual([FILE_URL]);
    expect(Array.from(bytesOfBase64(fonts().bytes[FILE_URL]))).toEqual(Array.from(FONT));
  });

  it('serves them back with no network', async () => {
    const { reader, fonts } = recording(network());
    await reader.text(CSS_URL);
    await reader.bytes(FILE_URL);
    const offline = network();

    const served = inlineReader(fonts(), offline);

    expect(await served.text(CSS_URL)).toBe('@font-face{}');
    expect(Array.from(await served.bytes(FILE_URL))).toEqual(Array.from(FONT));
    expect(offline.text).not.toHaveBeenCalled();
    expect(offline.bytes).not.toHaveBeenCalled();
  });

  it('asks the network for what it was not given', async () => {
    const offline = network();
    const served = inlineReader({ text: {}, bytes: {} }, offline);

    expect(await served.text(CSS_URL)).toBe('@font-face{}');
    expect(offline.text).toHaveBeenCalledTimes(1);
  });

  it('round-trips bytes through base64', () => {
    expect(Array.from(bytesOfBase64(base64Of(FONT)))).toEqual(Array.from(FONT));
  });
});
