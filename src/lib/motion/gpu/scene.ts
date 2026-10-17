import { ENGINE_GLOBAL, motionEngine } from '../engine/engine';
import { COMPOSITION_ID } from '../hyperframes/capture';
import { IDENTITY_3D, cssTransform, multiply, perspective, project, scaleOf, translation, type Mat4, type Size } from './matrix';
import { PaintKind } from './paint-of';

export type Point = [number, number];
export type Quad = [Point, Point, Point, Point];

export type Paint =
  | { kind: PaintKind.Fill; color: string; pattern: string }
  | { kind: PaintKind.Shape; markup: string; size: Size }
  | { kind: PaintKind.Image; src: string; fit: string }
  | { kind: PaintKind.Video; src: string; fit: string; start: number; duration: number; mediaStart: number; rate: number; element: Element }
  | { kind: PaintKind.Logo; src: string }
  | { kind: PaintKind.Text; box: HTMLElement; leaf: HTMLElement }
  | { kind: PaintKind.Html };

export type Link = { el: HTMLElement; size: Size; offset: Point; perspectiveFor: boolean };

export type SceneLayer = { clip: string; paint: Paint; links: Link[]; windows: [number, number][]; z: number[]; order: number; content: Size; blend: string };

type Timeline = { seek: (t: number) => void };

export type Scene = { width: number; height: number; background: string | null; layers: SceneLayer[]; timeline: Timeline; duration: number; doc: Document };

export type Drawn = { clip: string; layer: SceneLayer; paint: Paint; quad: Quad; matrix: Mat4; opacity: number; blur: number; blend: string; clips: Quad[]; content: Size; focus: Point };

const ROOT_BG = /#root\{background:([^};]+)/;
const TIMELINE_MARK = `__timelines[${JSON.stringify(COMPOSITION_ID)}]=tl`;
const INSET_CLASSES = ['layer', 'fx', 'kp', 'kf', 'ks', 'cc', 'kpc', 'kc', 'ksc'];
const NO_EFFECT = /mask|url\(|backdrop/;

const px = (v: string | null | undefined) => parseFloat(v ?? '') || 0;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function runTimeline(doc: Document): Timeline {
  const script = [...doc.querySelectorAll('script')].map((s) => s.textContent ?? '').find((s) => s.includes(TIMELINE_MARK)) ?? '';
  const win = { document: doc, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, __timelines: {} as Record<string, Timeline> } as unknown as Window & Record<string, unknown>;
  win[ENGINE_GLOBAL] = motionEngine(win);
  new Function('window', 'document', script)(win, doc);
  const tl = (win.__timelines as Record<string, Timeline>)[COMPOSITION_ID];
  return tl ?? { seek: () => {} };
}

function boxedChild(el: Element): boolean {
  return el.parentElement?.classList.contains('mv') === true && el.parentElement.parentElement?.classList.contains('box') === true;
}

const TEXT_EXTRAS = '.tu,.tw,.tg,img,svg,video,canvas';

function textParts(layer: Element): { el: HTMLElement; paint: Paint }[] {
  const block = layer.querySelector('[data-fit]') as HTMLElement | null;
  if (!block || !boxedChild(block) || block.querySelector(TEXT_EXTRAS) || layer.querySelectorAll('[data-fit]').length !== 1) {
    return [];
  }
  const box = block.parentElement!.parentElement as HTMLElement;
  const lines = [...block.querySelectorAll('.li')] as HTMLElement[];
  const whole = block.tagName === 'SPAN' ? block.parentElement! : block;
  return (lines.length ? lines : [whole]).map((leaf) => ({ el: leaf, paint: { kind: PaintKind.Text, box, leaf } }));
}

function paintOf(layer: Element): { el: HTMLElement; paint: Paint } | null {
  const fx = layer.querySelector(':scope > .fx');
  const fill = fx?.querySelector(':scope > div:not([class])') as HTMLElement | null;
  if (fill && fx!.children.length === 1 && /inset:\s*0/.test(fill.getAttribute('style') ?? '') && !fill.children.length) {
    return { el: fill, paint: { kind: PaintKind.Fill, color: fill.style.backgroundColor || fill.style.background, pattern: fill.style.backgroundImage } };
  }
  const svg = layer.querySelector('svg[id^="sv-"]') as HTMLElement | null;
  if (svg && svg.parentElement?.id.startsWith('sh-') && boxedChild(svg.parentElement)) {
    return { el: svg, paint: { kind: PaintKind.Shape, markup: svg.outerHTML, size: { width: px(svg.getAttribute('width')), height: px(svg.getAttribute('height')) } } };
  }
  const img = layer.querySelector('img') as HTMLImageElement | null;
  if (img && boxedChild(img) && layer.querySelectorAll('img,video,svg').length === 1) {
    const zoomed = img.style.transform.includes('--kc-zoom');
    const src = img.getAttribute('src') ?? '';
    return { el: img, paint: zoomed ? { kind: PaintKind.Image, src, fit: img.style.objectFit || 'cover' } : { kind: PaintKind.Logo, src } };
  }
  const video = layer.querySelector('video') as HTMLVideoElement | null;
  if (video && boxedChild(video) && layer.querySelectorAll('img,video,svg').length === 1) {
    return {
      el: video,
      paint: { kind: PaintKind.Video, src: video.getAttribute('src') ?? '', fit: video.style.objectFit || 'cover', start: px(video.dataset.start), duration: px(video.dataset.duration), mediaStart: px(video.dataset.mediaStart), rate: Number(video.dataset.playbackRate ?? 1), element: video }
    };
  }
  return null;
}

function chainOf(el: HTMLElement, root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let at: HTMLElement | null = el; at && at !== root; at = at.parentElement) {
    out.unshift(at);
  }
  return out;
}

const insetFull = (el: HTMLElement) => INSET_CLASSES.some((c) => el.classList.contains(c)) || /inset:\s*0/.test(el.getAttribute('style') ?? '');

function contentSize(paint: Paint, parent: Size): Size {
  const SIZE: Record<PaintKind, () => Size> = {
    [PaintKind.Fill]: () => parent,
    [PaintKind.Text]: () => parent,
    [PaintKind.Shape]: () => (paint as Extract<Paint, { kind: PaintKind.Shape }>).size,
    [PaintKind.Image]: () => parent,
    [PaintKind.Video]: () => parent,
    [PaintKind.Logo]: () => parent,
    [PaintKind.Html]: () => parent
  };
  return SIZE[paint.kind]();
}

function linksOf(chain: HTMLElement[], frame: Size, paint: Paint): Link[] {
  const links: Link[] = [];
  let parent: Size = frame;
  for (const el of chain) {
    const placed = el.style.position === 'absolute' && el.style.width;
    const size: Size = placed ? { width: px(el.style.width), height: px(el.style.height) } : parent;
    const offset: Point = placed && !insetFull(el) ? [px(el.style.left), px(el.style.top)] : [0, 0];
    links.push({ el, size, offset, perspectiveFor: false });
    parent = size;
  }
  const box = links.findIndex((l) => l.el.classList.contains('box'));
  if (box >= 0) {
    const boxSize = links[box].size;
    const content = contentSize(paint, boxSize);
    for (let i = box + 1; i < links.length; i++) {
      links[i].size = i === links.length - 1 ? content : { width: boxSize.width, height: links[box + 1].el.style.height === '100%' ? boxSize.height : content.height };
    }
    if (links[box + 1]) {
      links[box + 1].offset = [0, (boxSize.height - links[box + 1].size.height) / 2];
    }
  }
  return links;
}

function windowsOf(chain: HTMLElement[], paint: Paint): [number, number][] {
  const timed = chain.filter((el) => el.classList.contains('clip') && el.dataset.start !== undefined).map((el): [number, number] => [px(el.dataset.start), px(el.dataset.start) + px(el.dataset.duration)]);
  return paint.kind === PaintKind.Video ? [...timed, [paint.start, paint.start + paint.duration]] : timed;
}

const zOf = (chain: HTMLElement[]) => chain.filter((el) => el.classList.contains('layer')).map((el) => Number(el.style.zIndex) || 0);

const effectFree = (chain: HTMLElement[]) => chain.every((el) => !NO_EFFECT.test(el.getAttribute('style') ?? '') && !el.classList.contains('matte-src'));

function compareZ(a: SceneLayer, b: SceneLayer): number {
  for (let i = 0; i < Math.min(a.z.length, b.z.length); i++) {
    if (a.z[i] !== b.z[i]) {
      return a.z[i] - b.z[i];
    }
  }
  return a.order - b.order;
}

export function compileScene(html: string): Scene {
  const doc = parse(html);
  const root = doc.getElementById('root') as HTMLElement;
  const frame = { width: px(root.dataset.width), height: px(root.dataset.height) };
  const background = [...doc.querySelectorAll('style')].map((s) => ROOT_BG.exec(s.textContent ?? '')?.[1]).find(Boolean) ?? null;
  const leaves = [...root.querySelectorAll('.layer[data-clip]')].filter((l) => !l.querySelector('.layer[data-clip]'));
  let order = 0;
  const layers = leaves.flatMap((layer): SceneLayer[] => {
    const outer = chainOf(layer as HTMLElement, root);
    const blend = outer.map((el) => el.style.mixBlendMode).filter((b) => b && b !== 'normal').pop() ?? 'normal';
    const single = paintOf(layer);
    const found = single ? [single] : textParts(layer);
    const native = found.filter((f) => effectFree(chainOf(f.el, root)));
    const parts = native.length === found.length && found.length ? native : [{ el: layer as HTMLElement, paint: { kind: PaintKind.Html } as Paint }];
    return parts.map((part) => {
      const chain = chainOf(part.el, root);
      const links = part.paint.kind === PaintKind.Html ? [] : linksOf(chain, frame, part.paint);
      const content = links.length ? links[links.length - 1].size : frame;
      return { clip: (layer as HTMLElement).dataset.clip ?? '', paint: part.paint, links, windows: windowsOf(outer, part.paint), z: zOf(outer), order: order++, content, blend };
    });
  });
  return { ...frame, background: background?.trim() ?? null, layers: layers.sort(compareZ), timeline: runTimeline(doc), duration: px(root.dataset.duration), doc };
}

function originOf(el: HTMLElement, size: Size, prop: 'transformOrigin' | 'perspectiveOrigin', vars: Vars): Point {
  const KEYWORDS: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  const raw = resolved(el.style[prop] || '50% 50%', vars).split(/\s+(?![^(]*\))/);
  const axis = (v: string | undefined, ref: number) => (v === undefined ? ref / 2 : v in KEYWORDS ? KEYWORDS[v] * ref : v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v));
  return [axis(raw[0], size.width), axis(raw[1], size.height)];
}

type Vars = Map<string, string> | ((name: string) => string | undefined);

const VAR = /var\((--[\w-]+)(?:,\s*([^()]*))?\)/;
const CALC_PERCENT = /calc\(\s*([-\d.]+)\s*\*\s*100%\s*\)/g;
const MAX_DEPTH = 8;

const lookup = (vars: Vars, name: string) => (typeof vars === 'function' ? vars(name) : vars.get(name));

export function resolved(value: string, vars: Vars): string {
  let out = value;
  for (let i = 0; i < MAX_DEPTH && VAR.test(out); i++) {
    out = out.replace(/var\((--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name: string, fallback = '') => lookup(vars, name) ?? fallback.trim());
  }
  return out.replace(CALC_PERCENT, (_, n: string) => `${Number(n) * 100}%`);
}

function varsUpTo(links: Link[], index: number): Vars {
  return (name) => {
    for (let i = index; i >= 0; i--) {
      const v = links[i].el.style.getPropertyValue(name).trim();
      if (v && !v.includes(`var(${name}`)) {
        return v;
      }
    }
    return undefined;
  };
}

function linkMatrix(link: Link, parent: Link | null, vars: Vars): Mat4 {
  const { el, size, offset } = link;
  let m = translation(offset[0], offset[1]);
  if (parent?.el.style.perspective) {
    const [px0, py0] = originOf(parent.el, parent.size, 'perspectiveOrigin', vars);
    m = multiply(multiply(multiply(translation(px0, py0), perspective(parseFloat(parent.el.style.perspective))), translation(-px0, -py0)), m);
  }
  const transform = resolved(el.style.transform, vars);
  if (!transform || transform === 'none') {
    return m;
  }
  const [ox, oy] = originOf(el, size, 'transformOrigin', vars);
  return multiply(m, multiply(multiply(translation(ox, oy), cssTransform(transform, size)), translation(-ox, -oy)));
}

const insetOf = (clip: string) => /^inset\(([^)]*)\)/.exec(clip)?.[1].split(/\s+/).map((v) => v) ?? null;

function insetQuad(m: Mat4, size: Size, inset: string[]): Quad {
  const [t, r = t, b = t, l = r] = inset;
  const len = (v: string, ref: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0);
  const x0 = len(l, size.width);
  const y0 = len(t, size.height);
  const x1 = size.width - len(r, size.width);
  const y1 = size.height - len(b, size.height);
  return [project(m, x0, y0), project(m, x1, y0), project(m, x1, y1), project(m, x0, y1)];
}

const BLUR = /blur\(([\d.]+)px\)/;

const visibleAt = (layer: SceneLayer, t: number) => layer.windows.every(([a, b]) => t >= a && t < b);

function drawnOf(layer: SceneLayer, t: number): Drawn | null {
  if (!visibleAt(layer, t)) {
    return null;
  }
  let m = IDENTITY_3D;
  let opacity = 1;
  let blur = 0;
  let blend = 'normal';
  const clips: Quad[] = [];
  for (let i = 0; i < layer.links.length; i++) {
    const link = layer.links[i];
    const style = link.el.style;
    const vars = varsUpTo(layer.links, i);
    if (style.visibility === 'hidden' || style.display === 'none') {
      return null;
    }
    m = multiply(m, linkMatrix(link, layer.links[i - 1] ?? null, vars));
    opacity *= style.opacity === '' ? 1 : Number(style.opacity);
    blur += Number(BLUR.exec(style.filter)?.[1] ?? 0) * scaleOf(m);
    blend = style.mixBlendMode && style.mixBlendMode !== 'normal' ? style.mixBlendMode : blend;
    const inset = insetOf(style.clipPath);
    if (inset) {
      clips.push(insetQuad(m, link.size, inset));
    }
    if (style.overflow === 'hidden' && i < layer.links.length - 1) {
      clips.push(insetQuad(m, link.size, ['0']));
    }
  }
  const { width, height } = layer.content;
  const last = layer.links.length - 1;
  const [fx = '50%', fy = '50%'] = last >= 0 ? resolved(layer.links[last].el.style.objectPosition || '50% 50%', varsUpTo(layer.links, last)).split(/\s+/) : [];
  const focus: Point = [(parseFloat(fx) || 50) / 100, (parseFloat(fy) || 50) / 100];
  const quad: Quad = [project(m, 0, 0), project(m, width, 0), project(m, width, height), project(m, 0, height)];
  return { clip: layer.clip, layer, paint: layer.paint, quad, matrix: m, opacity, blur, blend, clips, content: layer.content, focus };
}

export function frameAt(scene: Scene, t: number): Drawn[] {
  scene.timeline.seek(t);
  return scene.layers.flatMap((layer) => {
    if (layer.paint.kind === PaintKind.Html) {
      return visibleAt(layer, t) ? [{ clip: layer.clip, layer, paint: layer.paint, quad: [[0, 0], [scene.width, 0], [scene.width, scene.height], [0, scene.height]] as Quad, matrix: IDENTITY_3D, opacity: 1, blur: 0, blend: 'normal', clips: [], content: layer.content, focus: [0.5, 0.5] as Point }] : [];
    }
    const d = drawnOf(layer, t);
    return d ? [d] : [];
  });
}
