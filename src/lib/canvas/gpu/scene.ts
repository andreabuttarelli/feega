import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite, VideoSource } from 'pixi8';
import type { Viewport } from '../dot-grid';
import { MOTION_NODE_BAR_H } from '../motion-node';
import { AssetSize, sized } from '../asset-url';
import { Surface, type CardFace, type Media } from './card-face';
import type { Box, Curve } from './geometry';
import { createTextureCache, fitBitmap, type TextureCache } from './texture-cache';
import { createUploadQueue, type UploadQueue } from './upload-queue';
import { textureDecoder } from './texture-decoder';
import { Counter, count, exposeTextures } from './frame-stats';
import { BUDGET, currentDevice, rendererResolution } from './memory-budget';
import { textureReport, type SourceSize } from './texture-bytes';
import { createPins } from './texture-pins';
import { Backend } from './backend';
import { ChromeLayer } from './chrome-layer';
import type { IdleChrome } from './idle-chrome';
import { grownBacking } from './backing-size';
import type { Theme } from './theme';

export { Backend };


export type Card = Box & { id: string; face: CardFace; rotation: number; hidden: boolean; snapshot: string | null; running: boolean; chrome: IdleChrome | null };
export type Peer = { id: string; name: string; color: string; at: { x: number; y: number } };
export type Overlay = {
  selected: (Box & { id: string })[];
  resizable: boolean;
  marquee: Box | null;
  ghost: Curve | null;
  ghostOk: boolean;
  hovered: Box | null;
  peers: Peer[];
};


const PAD = 14;
const LABEL_SIZE = 12;
const BODY_SIZE = 13;
const DOT_TILE = 24;
const LIVE_VIDEO_CAP = 4;
const NEAR_TIER_ZOOM = 0.75;
const TEXT_FADE_FROM_PX = 3;
const TEXT_FADE_PX = 3;
const MAX_TEXT_CHARS = 1400;
const TEXT_TIERS = [1, 2, 4] as const;
const THUMB_COLUMNS = 3;
const STAGE = '#000000';
const SKELETON_ROWS = 6;
const SKELETON_STEP = 22;
const SKELETON_BAR = 10;
const SKELETON_WIDTHS = [0.9, 0.75, 0.82, 0.6];
const THUMB_GAP = 4;

const tierFor = (zoom: number) => TEXT_TIERS.find((t) => t >= zoom * rendererResolution(devicePixelRatio, currentDevice())) ?? TEXT_TIERS[TEXT_TIERS.length - 1];

type Built = { id: string; root: Container; skin: Container; key: string; body: Sprite | null; video: HTMLVideoElement | null; texts: Text[]; skeletons: Graphics[]; media: Media | null; releases: (() => void)[]; loads: Load[]; loaded: boolean };

type Load = { url: string; show: (tex: Texture) => void; clear: () => void };

function dotTexture(theme: Theme): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = DOT_TILE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = theme.dot;
  ctx.beginPath();
  ctx.arc(DOT_TILE / 2, DOT_TILE / 2, 1, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

export enum GridPlace {
  Scene = 'scene',
  UnderCore = 'under-core'
}

export enum Fit {
  Cover = 'cover',
  Contain = 'contain'
}

function place(sprite: Sprite, tex: Texture, box: Box, fit: Fit) {
  if (fit === Fit.Cover) {
    sprite.texture = cover(tex, box.w, box.h);
    sprite.position.set(box.x, box.y);
    sprite.width = box.w;
    sprite.height = box.h;
    return;
  }
  const scale = Math.min(box.w / (tex.width || 1), box.h / (tex.height || 1));
  sprite.texture = tex;
  sprite.width = tex.width * scale;
  sprite.height = tex.height * scale;
  sprite.position.set(box.x + (box.w - sprite.width) / 2, box.y + (box.h - sprite.height) / 2);
}

function faceKey(c: Card): string {
  return c.snapshot ? `snap:${c.w}:${c.h}:${c.snapshot}` : JSON.stringify([c.w, c.h, c.face]);
}

function cover(tex: Texture, w: number, h: number): Texture {
  const tw = tex.source.width;
  const th = tex.source.height;
  if (!tw || !th) {
    return tex;
  }
  const scale = Math.max(w / tw, h / th);
  const fw = w / scale;
  const fh = h / scale;
  return new Texture({ source: tex.source, frame: new Rectangle((tw - fw) / 2, (th - fh) / 2, fw, fh) });
}

export class GpuScene {
  readonly backend: Backend;
  private app: Application;
  private host: HTMLElement;
  private theme: Theme;
  private grid: TilingSprite;
  private world = new Container();
  private cardLayer = new Container();
  private chrome: ChromeLayer;
  private overlay = new Graphics();
  private peerLayer = new Container();
  private built = new Map<string, Built>();
  private textures: TextureCache;
  private view: Viewport = { x: 0, y: 0, zoom: 1 };
  private tier = 1;
  private dirty = true;
  private frame = 0;
  private playing = new Set<HTMLVideoElement>();
  private cards: Card[] = [];
  private readonly uploads: UploadQueue;
  private overlayIn: Overlay | null = null;
  onFrame: ((ms: number) => void) | null = null;
  onLost: (() => void) | null = null;
  onReady: ((drawn: Set<string>) => void) | null = null;
  private ready = new Set<string>();
  private retiring = new Map<string, Built>();
  private snapshots = new Map<string, { key: string; tex: Texture }>();
  private staleSnapshots = new Map<string, Texture[]>();
  private renderFailed = false;
  private pins = createPins<Built>();
  private uploaded = new WeakSet<object>();
  private dim: { body: number; edges: number } | null = null;

  private constructor(app: Application, theme: Theme, host: HTMLElement) {
    this.app = app;
    this.host = host;
    this.theme = theme;
    this.backend = app.renderer.name === 'webgpu' ? Backend.WebGPU : Backend.WebGL;
    this.grid = new TilingSprite({ texture: dotTexture(theme), width: app.screen.width, height: app.screen.height });
    this.uploads = createUploadQueue({ now: () => performance.now(), rank: (url) => this.distanceOf(url) });
    this.textures = createTextureCache({
      decode: textureDecoder,
      queue: this.uploads,
      upload: (tex) => app.renderer.texture.initSource(tex.source),
      changed: () => this.invalidate(),
      device: currentDevice(),
      pinned: (url) => this.pins.pinned(url, (b) => b.root.visible),
      evicted: (url) => this.pins.owners(url).forEach((b) => this.unload(b))
    });
    this.chrome = new ChromeLayer({ font: theme.font, ink: theme.inkSoft, size: LABEL_SIZE });
    this.world.addChild(this.cardLayer, this.chrome.root, this.overlay, this.peerLayer);
    app.stage.addChild(this.grid, this.world);
    exposeTextures(() => textureReport((app.renderer.texture as unknown as { managedTextures: readonly (SourceSize | null)[] }).managedTextures));
    this.watchLoss();
    this.loop();
  }

  private watchLoss() {
    const lost = () => this.onLost?.();
    if (this.backend === Backend.WebGPU) {
      void (this.app.renderer as unknown as { gpu: { device: GPUDevice } }).gpu.device.lost.then(lost);
      return;
    }
    this.app.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      lost();
    });
  }

  loseForTest() {
    if (this.backend === Backend.WebGPU) {
      (this.app.renderer as unknown as { gpu: { device: GPUDevice } }).gpu.device.destroy();
      return;
    }
    const gl = (this.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  static async create(host: HTMLElement, preference: Backend, theme: Theme): Promise<GpuScene> {
    const app = new Application();
    await app.init({
      preference,
      width: host.clientWidth,
      height: host.clientHeight,
      antialias: BUDGET[currentDevice()].antialias,
      autoDensity: true,
      resolution: rendererResolution(devicePixelRatio, currentDevice()),
      backgroundAlpha: 0,
      autoStart: false,
      textureGCActive: false,
      gcActive: false
    });
    host.appendChild(app.canvas);
    app.canvas.dataset.testid = 'gpu-canvas';
    app.canvas.dataset.backend = app.renderer.name;
    return new GpuScene(app, theme, host);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  invalidate() {
    this.dirty = true;
  }

  placeGrid(place: GridPlace) {
    this.grid.visible = place === GridPlace.Scene;
    this.invalidate();
  }

  setCamera(view: Viewport) {
    this.view = view;
    this.world.position.set(view.x, view.y);
    this.world.scale.set(view.zoom);
    const tile = DOT_TILE * Math.max(view.zoom, 0.25);
    this.grid.tileScale.set(tile / DOT_TILE);
    this.grid.tilePosition.set(view.x % tile, view.y % tile);
    this.cull();
    this.retier();
    this.drawOverlay();
    this.drawPeers();
    this.invalidate();
  }

  setCards(cards: Card[]) {
    this.cards = cards;
    const seen = new Set<string>();
    cards.forEach((c, i) => {
      seen.add(c.id);
      const key = faceKey(c);
      let b = this.built.get(c.id);
      if (!b || b.key !== key) {
        const old = b;
        b = this.build(c, key);
        this.built.set(c.id, b);
        this.retire(old, b);
      }
      b.root.pivot.set(c.w / 2, c.h / 2);
      b.root.position.set(c.x + c.w / 2, c.y + c.h / 2);
      b.root.angle = c.rotation;
      b.skin.visible = !c.hidden;
      b.root.alpha = this.dim && !c.hidden ? this.dim.body : 1;
      this.cardLayer.setChildIndex(b.root, Math.min(i, this.cardLayer.children.length - 1));
    });
    for (const id of [...this.built.keys()]) {
      if (!seen.has(id)) {
        this.drop(id);
      }
    }
    this.cull();
    this.drawOverlay();
    this.invalidate();
  }

  awaitsMedia(id: string): boolean {
    const b = this.built.get(id);
    return !b || (!!b.media && !this.ready.has(id) && !this.retiring.has(id));
  }

  setIcon(kind: string, source: ImageBitmap) {
    this.chrome.setIcon(kind, source);
    this.setCards(this.cards);
  }

  private distanceOf(url: string): number {
    const v = this.visibleBox();
    const centre = { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const ids = new Set(this.pins.owners(url).map((b) => b.id));
    let nearest = Infinity;
    for (const c of this.cards) {
      if (ids.has(c.id)) {
        nearest = Math.min(nearest, Math.hypot(c.x + c.w / 2 - centre.x, c.y + c.h / 2 - centre.y));
      }
    }
    return nearest;
  }

  private seen(c: Box) {
    const v = this.visibleBox();
    const margin = 40 / this.view.zoom;
    return c.x + c.w > v.x - margin && c.y + c.h > v.y - margin && c.x < v.x + v.w + margin && c.y < v.y + v.h + margin;
  }

  async setSnapshot(id: string, key: string, full: ImageBitmap) {
    const bitmap = await fitBitmap(full, currentDevice());
    const old = this.snapshots.get(id);
    this.snapshots.set(id, { key, tex: Texture.from(bitmap) });
    if (old) {
      this.staleSnapshots.set(id, [...(this.staleSnapshots.get(id) ?? []), old.tex]);
    }
  }

  setDim(dim: { body: number; edges: number } | null) {
    this.dim = dim;
    this.setCards(this.cards);
  }

  setOverlay(o: Overlay) {
    this.overlayIn = o;
    this.drawOverlay();
    this.drawPeers();
    this.invalidate();
  }

  resize() {
    const grown = grownBacking({ width: this.host.clientWidth, height: this.host.clientHeight }, this.app.screen);
    if (grown) {
      this.app.renderer.resize(grown.width, grown.height);
    }
    this.grid.width = this.app.screen.width;
    this.grid.height = this.app.screen.height;
    this.cull();
    if (grown) {
      this.draw();
      return;
    }
    this.invalidate();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.onLost = null;
    for (const id of [...this.built.keys()]) {
      this.drop(id);
    }
    this.textures.clear();
    this.app.destroy(true, { children: true });
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    if (this.uploads.size()) {
      this.uploads.drain();
    }
    if (!this.dirty && !this.playing.size) {
      return;
    }
    this.draw();
  };

  private draw() {
    this.dirty = false;
    const t0 = performance.now();
    try {
      this.app.render();
      this.closeUploaded();
    } catch (err) {
      if (!this.renderFailed) {
        console.error('[canvas] render failed', err);
      }
      this.renderFailed = true;
    }
    this.onFrame?.(performance.now() - t0);
  }

  private closeUploaded() {
    for (const source of (this.app.renderer.texture as unknown as { managedTextures: readonly ({ resource: unknown } | null)[] }).managedTextures) {
      if (!source || this.uploaded.has(source) || !(source.resource instanceof ImageBitmap)) {
        continue;
      }
      this.uploaded.add(source);
      source.resource.close();
    }
  }

  private report() {
    this.onReady?.(new Set([...this.ready, ...this.retiring.keys()]));
  }

  private retire(old: Built | undefined, next: Built) {
    if (!old) {
      return;
    }
    if (!next.media) {
      this.destroyBuilt(old);
      if (old.media) {
        this.textures.drop(this.imageUrl(old.media.url));
      }
      return;
    }
    if (!this.ready.delete(old.id)) {
      this.destroyBuilt(old);
      this.report();
      return;
    }
    this.destroyBuilt(this.retiring.get(old.id));
    this.retiring.set(old.id, old);
    this.report();
  }

  private destroyBuilt(b: Built | undefined) {
    if (!b) {
      return;
    }
    if (b.video) {
      b.video.pause();
      this.playing.delete(b.video);
      b.video.removeAttribute('src');
      b.video.load();
    }
    if (this.retiring.get(b.id) === b) {
      this.retiring.delete(b.id);
    }
    this.pins.drop(b);
    for (const release of b.releases) {
      release();
    }
    b.root.destroy({ children: true });
  }

  private markReady(b: Built) {
    if (this.built.get(b.id) !== b) {
      return;
    }
    this.destroyBuilt(this.retiring.get(b.id));
    for (const tex of this.staleSnapshots.get(b.id) ?? []) {
      tex.destroy(true);
    }
    this.staleSnapshots.delete(b.id);
    count(Counter.Upload);
    this.ready.add(b.id);
    this.report();
  }

  private drop(id: string) {
    this.destroyBuilt(this.retiring.get(id));
    if (this.ready.delete(id)) {
      this.report();
    }
    this.destroyBuilt(this.built.get(id));
    this.built.delete(id);
  }


  private text(s: string, size: number, color: string, width: number | null, weight: '400' | '600' = '400'): Text {
    const t = new Text({
      text: s,
      resolution: this.tier,
      style: {
        fontFamily: this.theme.font,
        fontSize: size,
        fontWeight: weight,
        fill: color,
        letterSpacing: -0.2,
        lineHeight: size * 1.4,
        ...(width ? { wordWrap: true, wordWrapWidth: width, breakWords: true } : {})
      }
    });
    return t;
  }

  private clipLines(s: string, width: number, height: number, size: number): string {
    const perLine = Math.max(8, Math.floor(width / (size * 0.52)));
    const lines = Math.max(1, Math.floor(height / (size * 1.4)));
    const flat = s.slice(0, MAX_TEXT_CHARS);
    const max = perLine * lines;
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  }

  private panel(root: Container, c: Card, raised = true) {
    const g = new Graphics();
    if (raised) {
      g.rect(0, 2, c.w, c.h).fill({ color: 0x000000, alpha: 0.06 });
    }
    g.rect(0, 0, c.w, c.h).fill(this.theme.paper).stroke({ width: 1, color: this.theme.line, alignment: 1 });
    root.addChild(g);
  }

  private mediaSprite(root: Container, b: Built, media: Media, box: Box, fit: Fit = Fit.Cover) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.position.set(box.x, box.y);
    sprite.width = box.w;
    sprite.height = box.h;
    root.addChild(sprite);
    b.body = sprite;
    b.media = media;
    if (media.video) {
      this.attachVideo(b, media.url, box, fit);
      return;
    }
    b.loads.push({
      url: this.imageUrl(media.url),
      show: (tex) => {
        place(sprite, tex, box, fit);
        this.markReady(b);
      },
      clear: () => {
        sprite.texture = Texture.EMPTY;
      }
    });
  }

  private load(b: Built) {
    if (b.loaded || !b.loads.length) {
      return;
    }
    b.loaded = true;
    for (const l of b.loads) {
      this.pins.use(l.url, b);
      b.releases.push(this.textures.want(l.url, (tex) => !b.root.destroyed && l.show(tex)));
    }
  }

  private unload(b: Built) {
    if (!b.loaded || b.root.destroyed) {
      return;
    }
    b.loaded = false;
    this.pins.drop(b);
    for (const release of b.releases.splice(0)) {
      release();
    }
    for (const l of b.loads) {
      l.clear();
    }
    if (this.ready.delete(b.id)) {
      this.report();
    }
  }

  private imageUrl(url: string): string {
    return sized(url, this.view.zoom >= NEAR_TIER_ZOOM ? AssetSize.Px1024 : AssetSize.Px256);
  }

  private attachVideo(b: Built, url: string, box: Box, fit: Fit) {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.src = url;
    b.video = video;
    video.addEventListener('loadeddata', () => {
      if (!b.body || b.body.destroyed) {
        return;
      }
      const source = new VideoSource({ resource: video, autoPlay: false, autoLoad: true });
      place(b.body, new Texture({ source }), box, fit);
      this.markReady(b);
      this.cull();
      this.invalidate();
    });
  }

  private build(c: Card, key: string): Built {
    count(Counter.Build);
    const holder = new Container();
    const root = new Container();
    holder.addChild(root);
    const b: Built = { id: c.id, root: holder, skin: root, key, body: null, video: null, texts: [], skeletons: [], media: null, releases: [], loads: [], loaded: false };
    const f = c.face;
    const BUILD: Record<Surface, () => void> = {
      [Surface.Media]: () => {
        this.panel(root, c);
        if (f.media) {
          this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h }, Fit.Contain);
        }
      },
      [Surface.Frame]: () => {
        const stage = { x: 0, y: 0, w: c.w, h: Math.max(1, c.h - MOTION_NODE_BAR_H) };
        this.panel(root, c, false);
        const g = new Graphics();
        g.rect(stage.x, stage.y, stage.w, stage.h).fill(STAGE);
        root.addChild(g);
        const media = f.live ? { url: f.live, video: true } : f.media;
        if (media) {
          this.mediaSprite(root, b, media, stage, Fit.Contain);
        }
      },
      [Surface.Graphic]: () => f.media && this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h }, Fit.Contain),
      [Surface.Generate]: () => this.buildGenerate(root, b, c),
      [Surface.Text]: () => {
        this.panel(root, c);
        this.skeleton(root, b, c, PAD);
        this.body(root, b, f.text, c, PAD);
      },
      [Surface.Source]: () => {
        this.panel(root, c);
        if (f.media) {
          this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h });
          return;
        }
        const title = this.text(f.title || f.label || '', BODY_SIZE, this.theme.ink, c.w - PAD * 2, '600');
        title.position.set(PAD, PAD);
        root.addChild(title);
        b.texts.push(title);
        if (f.thumbs.length) {
          this.thumbGrid(root, b, f.thumbs, c, PAD + BODY_SIZE * 2);
          return;
        }
        this.skeleton(root, b, c, PAD + BODY_SIZE * 2);
        const sub = this.text(f.subtitle, BODY_SIZE - 1, this.theme.inkSoft, c.w - PAD * 2);
        sub.position.set(PAD, PAD + BODY_SIZE * 2);
        root.addChild(sub);
        b.texts.push(sub);
      },
      [Surface.Blank]: () => this.panel(root, c)
    };
    const snap = c.snapshot ? this.snapshots.get(c.id) : undefined;
    if (snap && snap.key === c.snapshot) {
      const sprite = new Sprite(snap.tex);
      sprite.width = c.w;
      sprite.height = c.h;
      root.addChild(sprite);
      b.body = sprite;
      b.media = { url: snap.key, video: false };
      queueMicrotask(() => this.markReady(b));
    } else {
      BUILD[f.surface]();
    }
    this.cardLayer.addChild(holder);
    holder.visible = this.seen(c);
    if (holder.visible) {
      this.load(b);
    }
    return b;
  }

  private thumbGrid(root: Container, b: Built, urls: string[], c: Card, top: number) {
    const cell = (c.w - PAD * 2 - THUMB_GAP * (THUMB_COLUMNS - 1)) / THUMB_COLUMNS;
    const rows = Math.max(0, Math.floor((c.h - top - PAD + THUMB_GAP) / (cell + THUMB_GAP)));
    const shown = urls.slice(0, rows * THUMB_COLUMNS);
    const wells = new Graphics();
    root.addChild(wells);
    shown.forEach((url, i) => {
      const box = { x: PAD + (i % THUMB_COLUMNS) * (cell + THUMB_GAP), y: top + Math.floor(i / THUMB_COLUMNS) * (cell + THUMB_GAP), w: cell, h: cell };
      wells.rect(box.x, box.y, box.w, box.h).fill(this.theme.line);
      const sprite = new Sprite(Texture.EMPTY);
      sprite.position.set(box.x, box.y);
      root.addChild(sprite);
      b.loads.push({
        url,
        show: (tex) => {
          sprite.texture = cover(tex, cell, cell);
          sprite.width = cell;
          sprite.height = cell;
        },
        clear: () => {
          sprite.texture = Texture.EMPTY;
        }
      });
    });
  }

  private skeleton(root: Container, b: Built, c: Card, top: number, bottom = PAD) {
    const g = new Graphics();
    const width = c.w - PAD * 2;
    const rows = Math.max(1, Math.min(SKELETON_ROWS, Math.floor((c.h - top - bottom) / SKELETON_STEP)));
    for (let i = 0; i < rows; i++) {
      g.rect(PAD, top + i * SKELETON_STEP, width * SKELETON_WIDTHS[i % SKELETON_WIDTHS.length], SKELETON_BAR).fill({ color: this.theme.line, alpha: 0.9 });
    }
    root.addChild(g);
    b.skeletons.push(g);
  }

  private body(root: Container, b: Built, s: string, c: Card, top: number, bottom = PAD) {
    const width = c.w - PAD * 2;
    const t = this.text(this.clipLines(s, width, c.h - top - bottom, BODY_SIZE), BODY_SIZE, this.theme.ink, width);
    t.position.set(PAD, top);
    root.addChild(t);
    b.texts.push(t);
  }

  private buildGenerate(root: Container, b: Built, c: Card) {
    const f = c.face;
    this.panel(root, c);
    const footer = BODY_SIZE * 2.4;
    if (f.media) {
      this.mediaSprite(root, b, f.media, { x: 1, y: 1, w: c.w - 2, h: c.h - footer - 1 });
    } else {
      this.skeleton(root, b, c, PAD, footer + PAD);
      this.body(root, b, f.text || f.prompt || 'Describe what to generate…', c, PAD, footer + PAD);
    }
    const g = new Graphics();
    g.rect(0, c.h - footer, c.w, 1).fill(this.theme.line);
    const status = f.error ? '#c0392b' : f.running ? this.theme.accent : f.media ? '#16a34a' : this.theme.line;
    g.circle(PAD, c.h - footer / 2, 4).fill(status);
    root.addChild(g);
    const model = this.text(f.error ?? (f.running ? 'Running…' : f.model ?? 'Auto'), BODY_SIZE - 1, this.theme.inkSoft, null);
    model.position.set(PAD + 12, c.h - footer / 2 - BODY_SIZE * 0.7);
    root.addChild(model);
    b.texts.push(model);
  }

  private visibleBox(): Box {
    const z = this.view.zoom;
    return { x: -this.view.x / z, y: -this.view.y / z, w: this.app.screen.width / z, h: this.app.screen.height / z };
  }

  private cull() {
    this.chrome.set(this.cards, (c) => this.seen(c));
    let live = 0;
    for (const c of this.cards) {
      const b = this.built.get(c.id);
      if (!b) {
        continue;
      }
      const seen = this.seen(c);
      b.root.visible = seen;
      if (seen) {
        this.load(b);
      }
      for (const t of b.texts) {
        t.alpha = Math.max(0, Math.min(1, (Number(t.style.fontSize) * this.view.zoom - TEXT_FADE_FROM_PX) / TEXT_FADE_PX));
      }
      const textAlpha = Math.max(0, Math.min(1, (BODY_SIZE * this.view.zoom - TEXT_FADE_FROM_PX) / TEXT_FADE_PX));
      for (const g of b.skeletons) {
        g.alpha = 1 - textAlpha;
      }
      if (!b.video) {
        continue;
      }
      const play = seen && !c.hidden && live < LIVE_VIDEO_CAP;
      live += play ? 1 : 0;
      this.setPlaying(b.video, play);
    }
  }

  private setPlaying(video: HTMLVideoElement, play: boolean) {
    if (play && !this.playing.has(video)) {
      this.playing.add(video);
      void video.play().catch(() => this.playing.delete(video));
      return;
    }
    if (!play && this.playing.has(video)) {
      this.playing.delete(video);
      video.pause();
    }
  }

  private retier() {
    const tier = tierFor(this.view.zoom);
    if (tier === this.tier) {
      return;
    }
    this.tier = tier;
    this.chrome.setTier(tier);
    for (const b of this.built.values()) {
      for (const t of b.texts) {
        t.resolution = tier;
      }
    }
  }

  private drawOverlay() {
    const g = this.overlay;
    g.clear();
    const o = this.overlayIn;
    if (!o) {
      return;
    }
    const z = this.view.zoom;
    const line = 1.5 / z;
    if (o.hovered) {
      g.rect(o.hovered.x, o.hovered.y, o.hovered.w, o.hovered.h).stroke({ width: line, color: this.theme.accent, alpha: 0.5 });
    }
    for (const c of this.cards) {
      if (c.running && !c.hidden) {
        g.rect(c.x, c.y, c.w, c.h).stroke({ width: line * 1.5, color: this.theme.accent });
      }
    }
    if (o.marquee) {
      const m = o.marquee;
      g.rect(m.x, m.y, m.w, m.h).fill({ color: this.theme.accent, alpha: 0.08 }).stroke({ width: line, color: this.theme.accent });
    }
    if (o.ghost) {
      const c = o.ghost;
      g.moveTo(c.from.x, c.from.y).bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.to.x, c.to.y).stroke({ width: line, color: o.ghostOk ? this.theme.accent : '#c0392b' });
    }
  }

  private drawPeers() {
    const layer = this.peerLayer;
    for (const child of [...layer.children]) {
      child.destroy({ children: true });
    }
    for (const p of this.overlayIn?.peers ?? []) {
      const c = new Container();
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(0, 16).lineTo(4.5, 12).lineTo(11, 12).closePath().fill(p.color).stroke({ width: 1, color: '#ffffff' });
      const name = this.text(p.name, 11, '#ffffff', null, '600');
      const tag = new Graphics();
      tag.roundRect(10, 16, name.width + 10, 18, 9).fill(p.color);
      name.position.set(15, 18);
      c.addChild(g, tag, name);
      c.position.set(p.at.x, p.at.y);
      c.scale.set(1 / this.view.zoom);
      layer.addChild(c);
    }
  }
}

export type { TextureCache };
