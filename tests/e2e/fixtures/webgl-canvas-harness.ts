import { Application, BitmapText, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi8';
import { hitTop, panBy, toWorld, visibleIds, zoomAt, type Point, type Rect } from '$lib/canvas/gpu/camera';
import type { Viewport } from '$lib/canvas/dot-grid';
import { nodeSize } from '$lib/canvas/node-size';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml, CAPTURE_REPLY, CAPTURE_REQUEST } from '$lib/motion/hyperframes/compose';
import { FrameFormat, type CaptureReply } from '$lib/motion/hyperframes/capture';
import { exactSeek } from '$lib/motion/hyperframes/exact-seek';
import { insertTemplate, setTemplateValues } from '$lib/motion/template/library';
import { SPLIT_HEADLINE_TEMPLATE } from '$lib/motion/template/split-headline/template';

export enum Backend {
  WebGpu = 'webgpu',
  WebGl = 'webgl'
}

export enum Live {
  On = 'on',
  Off = 'off'
}

enum Kind {
  Frame = 'frame',
  Image = 'image',
  Card = 'card'
}

type SceneNode = Rect & { kind: Kind; view: Container };
type Stats = { renderer: string; captures: number[]; uploads: number[] };

const FORMATS = [MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square, MotionFormat.Portrait];
const STEP = { x: 520, y: 640 };
const FRAMES = 50;
const IMAGES = 50;
const POSTER_PX = 512;
const IMAGE_PX = 256;
const CARD = { w: 320, h: 200 };
const EDGE_EVERY = 2;
const WHEEL_ZOOM = 0.0025;
const LIVE_EVERY_MS = 100;
const LIVE_SECONDS = 4;
const SELECTED = 0x2f6bff;
const BACKGROUND = '#f4f4f2';
const PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#777"/></svg>');

function noise(px: number, hue: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const g = canvas.getContext('2d')!;
  g.fillStyle = `hsl(${hue} 50% 40%)`;
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `hsla(${(hue + i) % 360} 60% ${30 + (i % 50)}% / 0.5)`;
    g.fillRect(Math.random() * px, Math.random() * px, px / 10, px / 10);
  }
  return Texture.from(canvas);
}

function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 24;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#c8c8c4';
  g.fillRect(11, 11, 2, 2);
  return Texture.from(canvas);
}

function liveHtml() {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), SPLIT_HEADLINE_TEMPLATE, { from: 0, newId: () => `f${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  const set = setTemplateValues(placed.doc, placed.clipId, { media: 'photo' });
  if (!set.ok) {
    throw new Error(set.error);
  }
  return { html: composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { photo: PHOTO } }), width: set.doc.width, height: set.doc.height };
}

function kindOf(i: number) {
  if (i < FRAMES) {
    return Kind.Frame;
  }
  return i < FRAMES + IMAGES ? Kind.Image : Kind.Card;
}

function sizeOf(kind: Kind, i: number) {
  if (kind === Kind.Frame) {
    return nodeSize('motion', { format: FORMATS[i % FORMATS.length] });
  }
  return kind === Kind.Image ? { w: 320, h: 320 } : CARD;
}

async function mount(count: number, backend: Backend, liveMode: Live) {
  document.body.replaceChildren();
  document.body.style.margin = '0';
  const app = new Application();
  await app.init({ preference: backend, resizeTo: window, antialias: true, autoDensity: true, resolution: devicePixelRatio, background: BACKGROUND, autoStart: false });
  app.canvas.dataset.testid = 'webgl-canvas';
  document.body.appendChild(app.canvas);
  const stats: Stats = { renderer: app.renderer.name, captures: [], uploads: [] };

  const grid = new TilingSprite({ texture: dotTexture(), width: innerWidth, height: innerHeight });
  const world = new Container();
  const wires = new Graphics();
  const outline = new Graphics();
  app.stage.addChild(grid, world);
  world.addChild(wires);
  app.stage.eventMode = 'none';

  const posters = Array.from({ length: FRAMES }, (_, i) => noise(POSTER_PX, (i * 37) % 360));
  const images = Array.from({ length: IMAGES }, (_, i) => noise(IMAGE_PX, (i * 53) % 360));
  const columns = Math.ceil(Math.sqrt(count));
  const nodes: SceneNode[] = [];

  for (let i = 0; i < count; i++) {
    const kind = kindOf(i);
    const size = sizeOf(kind, i);
    const view = new Container();
    const x = (i % columns) * STEP.x;
    const y = Math.floor(i / columns) * STEP.y;
    view.position.set(x, y);
    const border = new Sprite({ texture: Texture.WHITE, width: size.w + 2, height: size.h + 2, x: -1, y: -1, tint: 0xd8d8d4 });
    const body = new Sprite({ texture: kind === Kind.Frame ? posters[i % FRAMES] : kind === Kind.Image ? images[i % IMAGES] : Texture.WHITE, width: size.w, height: size.h });
    const label = new BitmapText({ text: `${kind} ${i}`, style: { fontFamily: 'Arial', fontSize: 22, fill: 0x222222 }, x: 0, y: -30 });
    view.addChild(border, body, label);
    if (kind === Kind.Card) {
      view.addChild(new BitmapText({ text: 'Lorem ipsum dolor sit amet,\nconsectetur adipiscing.', style: { fontFamily: 'Arial', fontSize: 20, fill: 0x555555 }, x: 16, y: 16 }));
    }
    world.addChild(view);
    nodes.push({ id: `n${i}`, x, y, w: size.w, h: size.h, kind, view });
  }
  world.addChild(outline);

  const edges = nodes.filter((_, i) => i % EDGE_EVERY === 0 && i + 1 < nodes.length).map((n) => [n, nodes[nodes.indexOf(n) + 1]] as const);
  let view: Viewport = { x: 40, y: 80, zoom: 0.5 };
  let selected: SceneNode | null = null;
  let dirty = true;

  function drawWires() {
    wires.clear();
    for (const [a, b] of edges) {
      const from = { x: a.x + a.w, y: a.y + a.h / 2 };
      const to = { x: b.x, y: b.y + b.h / 2 };
      const bend = Math.max(40, (to.x - from.x) / 2);
      wires.moveTo(from.x, from.y).bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
    }
    wires.stroke({ width: 2, color: 0x9a9a96 });
  }

  function drawOutline() {
    outline.clear();
    if (!selected) {
      return;
    }
    outline.rect(selected.x - 3, selected.y - 3, selected.w + 6, selected.h + 6).stroke({ width: 2 / view.zoom, color: SELECTED });
  }

  function applyView() {
    world.position.set(view.x, view.y);
    world.scale.set(view.zoom);
    grid.width = innerWidth;
    grid.height = innerHeight;
    grid.tilePosition.set(view.x, view.y);
    grid.tileScale.set(view.zoom);
    const seen = visibleIds(nodes, view, { width: innerWidth, height: innerHeight });
    for (const n of nodes) {
      n.view.visible = seen.has(n.id);
    }
    drawOutline();
    dirty = true;
  }

  drawWires();
  applyView();

  const loop = () => {
    if (dirty) {
      app.render();
      dirty = false;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const canvas = app.canvas;
  const at = (e: PointerEvent | WheelEvent): Point => ({ x: e.clientX, y: e.clientY });
  let gesture: { mode: 'pan' | 'drag'; last: Point } | null = null;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view = e.ctrlKey ? zoomAt(view, at(e), Math.exp(-e.deltaY * WHEEL_ZOOM)) : panBy(view, { x: -e.deltaX, y: -e.deltaY });
    applyView();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const hit = e.button === 0 ? (hitTop(nodes, toWorld(view, at(e))) as SceneNode | null) : null;
    selected = hit;
    gesture = { mode: hit ? 'drag' : 'pan', last: at(e) };
    applyView();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!gesture) {
      return;
    }
    const p = at(e);
    const d = { x: p.x - gesture.last.x, y: p.y - gesture.last.y };
    gesture.last = p;
    if (gesture.mode === 'pan' || !selected) {
      view = panBy(view, d);
      applyView();
      return;
    }
    selected.x += d.x / view.zoom;
    selected.y += d.y / view.zoom;
    selected.view.position.set(selected.x, selected.y);
    drawWires();
    drawOutline();
    dirty = true;
  });

  canvas.addEventListener('pointerup', () => (gesture = null));

  const live = nodes.find((n) => n.kind === Kind.Frame)!;
  const liveSprite = live.view.children[1] as Sprite;
  const { html, width, height } = liveHtml();
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px`, border: '0' });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  let pending: { id: string; t0: number } | null = null;
  let second = 0;

  window.addEventListener('message', (e: MessageEvent<CaptureReply>) => {
    if (e.data?.type !== CAPTURE_REPLY || e.data.id !== pending?.id || !e.data.bitmap) {
      return;
    }
    stats.captures.push(performance.now() - pending.t0);
    const t1 = performance.now();
    const old = liveSprite.texture;
    liveSprite.texture = Texture.from(e.data.bitmap);
    if (!posters.includes(old)) {
      old.destroy(true);
    }
    stats.uploads.push(performance.now() - t1);
    pending = null;
    dirty = true;
  });

  const capture = () => {
    if (pending || !frame.contentWindow || !live.view.visible) {
      return;
    }
    second = (second + LIVE_EVERY_MS / 1000) % LIVE_SECONDS;
    pending = { id: crypto.randomUUID(), t0: performance.now() };
    frame.contentWindow.postMessage(exactSeek(second), '*');
    frame.contentWindow.postMessage({ type: CAPTURE_REQUEST, id: pending.id, format: FrameFormat.Bitmap, width: live.w * 2, height: live.h * 2 }, '*');
  };
  frame.addEventListener('load', () => {
    if (liveMode === Live.On) {
      setInterval(capture, LIVE_EVERY_MS);
    }
  });

  const centre = () => {
    const n = nodes.find((m) => m.view.visible && m.x * view.zoom + view.x > 0 && m.y * view.zoom + view.y > 0)!;
    return { x: (n.x + n.w / 2) * view.zoom + view.x, y: (n.y + n.h / 2) * view.zoom + view.y };
  };

  return { stats, centre, memory: () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0 };
}

type Mounted = Awaited<ReturnType<typeof mount>>;

declare global {
  interface Window {
    webglCanvas: { mount: (count: number, backend: Backend, live: Live) => Promise<string>; current?: Mounted };
  }
}

window.webglCanvas = {
  mount: async (count, backend, live) => {
    window.webglCanvas.current = await mount(count, backend, live);
    return window.webglCanvas.current.stats.renderer;
  }
};
