import { base64Of, bytesOfBase64, type InlineFonts } from '../inline-core';
import type { Reader } from './load';

export type { InlineFonts };

export function recording(read: Reader): { reader: Reader; fonts: () => InlineFonts } {
  const kept: InlineFonts = { text: {}, bytes: {} };
  return {
    reader: {
      text: async (url) => {
        const text = await read.text(url);
        if (text) {
          kept.text[url] = text;
        }
        return text;
      },
      bytes: async (url) => {
        const bytes = await read.bytes(url);
        kept.bytes[url] = base64Of(bytes);
        return bytes;
      }
    },
    fonts: () => kept
  };
}

export const inlineReader = (fonts: InlineFonts, fallback: Reader): Reader => ({
  text: async (url) => fonts.text[url] ?? fallback.text(url),
  bytes: async (url) => (url in fonts.bytes ? bytesOfBase64(fonts.bytes[url]) : fallback.bytes(url))
});
