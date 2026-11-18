import { everyClip } from '@feega/motion-core/motion/doc';
import type { ComposeInput } from '@feega/motion-core/motion/hyperframes/compose';
import { fontLoader, type Reader } from '@feega/motion-core/motion/gpu-full/text/load';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';

const BROWSER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const browserFontReader: Reader = {
  text: (url) => fetch(url, { headers: { 'user-agent': BROWSER_AGENT } }).then((r) => (r.ok ? r.text() : '')),
  bytes: (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))).then((b) => new Uint8Array(b))
};

const loadFonts = fontLoader(browserFontReader);

const laysOut = (compose: ComposeInput) => everyClip(compose.doc).some((c) => c.autoLayout);

export async function withShapedText(compose: ComposeInput): Promise<ComposeInput> {
  if (compose.measure || !laysOut(compose)) {
    return compose;
  }
  const fonts = await loadFonts(compose.doc, compose.assets, compose.tokens);
  return { ...compose, measure: shapedText({ fonts, smoothing: Smoothing.Plain }) };
}
