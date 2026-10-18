import { toCanvas } from 'html-to-image';
import { fitSize } from '../hyperframes/fit-runtime';
import { PaintKind } from './paint-of';
import type { Scene, SceneLayer } from './scene';

export type TextRaster = { canvas: HTMLCanvasElement; width: number; height: number };

type TextPaint = Extract<SceneLayer['paint'], { kind: PaintKind.Text }>;

const MIN_TEXT_SCALE = 1;
const FONT_SHEET = /@font-face|fonts\.googleapis/;
const FONT_URL = /url\((['"]?)(https?:[^'")]+)\1\)/g;
const STRIPPED = ['transform', 'opacity', 'filter', 'visibility'];
const OFFSCREEN = 'position:fixed;left:-100000px;top:0;pointer-events:none;contain:strict';

const pathOf = (el: Element, root: Element): number[] => {
  const path: number[] = [];
  for (let at: Element | null = el; at && at !== root; at = at.parentElement) {
    path.unshift([...(at.parentElement?.children ?? [])].indexOf(at));
  }
  return path;
};

const follow = (root: Element, path: number[]): HTMLElement => path.reduce<Element>((at, i) => at.children[i], root) as HTMLElement;

function sheetLoaded(link: HTMLLinkElement): Promise<void> {
  return link.sheet ? Promise.resolve() : new Promise((ok) => ['load', 'error'].forEach((e) => link.addEventListener(e, () => ok(), { once: true })));
}

function installFonts(page: Document): Promise<void[]> {
  const loads: Promise<void>[] = [];
  for (const el of page.head.querySelectorAll('link[rel="stylesheet"], style')) {
    const markup = el.outerHTML;
    if (!FONT_SHEET.test(markup)) {
      continue;
    }
    const present = [...document.head.children].find((c) => c.outerHTML === markup);
    const node = present ?? document.head.appendChild(document.importNode(el, true));
    if (node instanceof HTMLLinkElement) {
      loads.push(sheetLoaded(node));
    }
  }
  return Promise.all(loads);
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((ok) => {
    const reader = new FileReader();
    reader.onload = () => ok(String(reader.result));
    reader.readAsDataURL(blob);
  });

async function embeddedFonts(page: Document): Promise<string> {
  const sheets = [...page.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter((l) => FONT_SHEET.test(l.href));
  const inline = [...page.head.querySelectorAll('style')].map((s) => s.textContent ?? '').filter((t) => t.includes('@font-face'));
  const fetched = await Promise.all(sheets.map((l) => fetch(l.href).then((r) => r.text()).catch(() => '')));
  const css = [...fetched, ...inline].join('\n');
  const urls = [...new Set([...css.matchAll(FONT_URL)].map((m) => m[2]))];
  const data = await Promise.all(urls.map((u) => fetch(u).then((r) => r.blob()).then(dataUrl).catch(() => u)));
  return urls.reduce((out, u, i) => out.split(u).join(data[i]), css);
}

function restPose(root: HTMLElement) {
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    STRIPPED.forEach((p) => el.style.removeProperty(p));
  }
}

function fit(block: HTMLElement, box: HTMLElement) {
  const measure = (size: number) => {
    block.style.fontSize = `${size}px`;
    const widths = [block.scrollWidth, block.offsetWidth, ...[...block.querySelectorAll<HTMLElement>('*')].map((c) => c.scrollWidth)];
    return { width: Math.max(...widths), height: block.offsetHeight };
  };
  block.style.fontSize = `${fitSize(Number(block.dataset.fit), measure, { width: box.clientWidth, height: box.clientHeight })}px`;
}

async function raster(leaf: HTMLElement, fontEmbedCSS: string, scale: number): Promise<TextRaster> {
  const { width, height } = leaf.getBoundingClientRect();
  const canvas = await toCanvas(leaf, { pixelRatio: scale, width, height, fontEmbedCSS, style: { margin: '0', transform: 'none' } });
  return { canvas, width, height };
}

function placeLinks(layer: SceneLayer, clone: HTMLElement, box: HTMLElement) {
  const boxAt = layer.links.findIndex((l) => l.el === box);
  for (let i = boxAt + 1; i < layer.links.length; i++) {
    const own = follow(clone, pathOf(layer.links[i].el, box)).getBoundingClientRect();
    const parent = follow(clone, pathOf(layer.links[i - 1].el, box)).getBoundingClientRect();
    layer.links[i].offset = [own.left - parent.left, own.top - parent.top];
    layer.links[i].size = { width: own.width, height: own.height };
  }
}

export async function layoutText(scene: Scene, host: HTMLElement, resolution = 1): Promise<Map<SceneLayer, TextRaster>> {
  const texts = scene.layers.filter((l) => l.paint.kind === PaintKind.Text);
  const out = new Map<SceneLayer, TextRaster>();
  if (!texts.length) {
    return out;
  }
  const [, fontCss] = await Promise.all([installFonts(scene.doc), embeddedFonts(scene.doc)]);
  const holder = Object.assign(document.createElement('div'), { style: `${OFFSCREEN};width:${scene.width}px;height:${scene.height}px` });
  host.appendChild(holder);
  const shadow = holder.attachShadow({ mode: 'open' });
  scene.doc.head.querySelectorAll('style').forEach((s) => shadow.appendChild(s.cloneNode(true)));
  const stage = Object.assign(document.createElement('div'), { style: `position:relative;width:${scene.width}px;height:${scene.height}px` });
  shadow.appendChild(stage);
  const clones = new Map<HTMLElement, HTMLElement>();
  for (const layer of texts) {
    const { box } = layer.paint as TextPaint;
    if (!clones.has(box)) {
      const clone = box.cloneNode(true) as HTMLElement;
      restPose(clone);
      clones.set(box, stage.appendChild(clone));
    }
  }
  const fonts = [...clones.values()].flatMap((clone) => [clone, ...clone.querySelectorAll<HTMLElement>('*')].map((el) => getComputedStyle(el).font));
  await Promise.all([...new Set(fonts)].map((font) => document.fonts.load(font).catch(() => [])));
  await document.fonts.ready;
  for (const clone of clones.values()) {
    const block = clone.querySelector<HTMLElement>('[data-fit]');
    if (block) {
      fit(block, clone);
    }
  }
  for (const layer of texts) {
    const { box, leaf } = layer.paint as TextPaint;
    const clone = clones.get(box)!;
    placeLinks(layer, clone, box);
    const drawn = await raster(follow(clone, pathOf(leaf, box)), fontCss, Math.max(MIN_TEXT_SCALE, resolution));
    layer.content = { width: drawn.width, height: drawn.height };
    out.set(layer, drawn);
  }
  holder.remove();
  return out;
}
