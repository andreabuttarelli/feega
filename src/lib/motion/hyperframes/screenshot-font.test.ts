// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HOSTED, Script } from '$lib/motion/libs/catalog';
import { captureScript } from './capture';

type HtmlToImage = { toSvg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string> };

const lib = HOSTED[Script.Screenshot];
const hosted = readFileSync(resolve('node_modules', lib.pkg, lib.source), 'utf8');

const computed = window.getComputedStyle.bind(window);
const chromeComputed = (el: Element) => Object.defineProperty(computed(el), 'cssText', { value: '' });

function screenshotTool(): HtmlToImage {
  Object.assign(window, { SVGImageElement: window.SVGImageElement ?? class {} });
  vi.spyOn(window, 'getComputedStyle').mockImplementation(chromeComputed);
  new Function(hosted).call(window);
  return (window as unknown as { htmlToImage: HtmlToImage }).htmlToImage;
}

describe('the hosted screenshot library', () => {
  it('keeps a fractional font size instead of flooring it', async () => {
    const node = document.createElement('div');
    node.style.fontSize = '79.92px';
    node.textContent = 'Night Session';
    document.body.appendChild(node);

    const svg = decodeURIComponent(await screenshotTool().toSvg(node, { width: 200, height: 100, fontEmbedCSS: '', skipFonts: true, includeStyleProperties: ['font-size'] }));

    expect(svg).toContain('font-size: 79.92px');
  });
});

describe('the capture runtime', () => {
  it('draws text at precise geometry, so a slow push-in does not snap glyphs frame to frame on Linux', () => {
    expect(captureScript({ width: 100, height: 100 }, 's', '/lib.js')).toContain('text-rendering:geometricPrecision');
  });
});
