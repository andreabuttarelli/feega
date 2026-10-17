import { Application, Color, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite, VideoSource } from 'pixi8';
import type { Viewport } from '../dot-grid';
import { MOTION_NODE_BAR_H } from '../motion-node';
import { AssetSize, sized } from '../asset-url';
import { Surface, type CardFace, type Media } from './card-face';
import { cornersOf, curvePoint, type Box, type Curve } from './geometry';
import { createTextureCache, type TextureCache } from './texture-cache';
import { Backend } from './backend';

export { Backend };


export type Card = Box & { id: string; face: CardFace; rotation: number; hidden: boolean };
export type Wire = { id: string; curve: Curve; iterate: boolean; selected: boolean };
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

export type Theme = { canvas: string; dot: string; paper: string; line: string; ink: string; inkSoft: string; accent: string; iterate: string; wire: string; font: string };

const PAD = 14;
const BODY_SIZE = 13;
const CORNER_PX = 8;
const DOT_TILE = 24;
const DASH = 6;
const GAP = 4;
const DASH_SAMPLES = 400;
const WIRE_WIDTH = 1;
const BADGE_STROKE = 1.5;
const ITERATE_BADGE_R = 11;
const LIVE_VIDEO_CAP = 4;
const NEAR_TIER_ZOOM = 0.75;
const TEXT_FADE_FROM_PX = 3;
const TEXT_FADE_PX = 3;
const MAX_TEXT_CHARS = 1400;
const TEXT_TIERS = [1, 2, 4] as const;
const THUMB_COLUMNS = 3;
const STAGE = '#000000';
const BAR_BUTTON = 44;
const BAR_ICON = 16;
const BAR_ICON_SCALE = 2;
const OPEN_LABEL = 'Open editor';
const ICON_PATHS: { paths: string; dim?: boolean; accent?: boolean }[] = [
  { paths: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>' },
  { paths: '<rect width="18" height="18" x="3" y="3" rx="2"/>', dim: true },
  { paths: '<path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"/><path d="M3 20V4"/>' },
  { paths: '<path d="M21 4v16"/><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>' },
  { paths: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>' },
  { paths: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>', accent: true }
];
const THUMB_GAP = 4;

const tierFor = (zoom: number) => TEXT_TIERS.find((t) => t >= zoom * devicePixelRatio) ?? TEXT_TIERS[TEXT_TIERS.length - 1];

type Built = { id: string; root: Container; skin: Container; key: string; body: Sprite | null; video: HTMLVideoElement | null; texts: Text[]; media: Media | null };

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
  return JSON.stringify([c.w, c.h, c.face]);
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
  private theme: Theme;
  private grid: TilingSprite;
  private world = new Container();
  private wires = new Graphics();
  private cardLayer = new Container();
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
  private wiresIn: Wire[] = [];
  private overlayIn: Overlay | null = null;
  onFrame: ((ms: number) => void) | null = null;
  onReady: ((drawn: Set<string>) => void) | null = null;
  private ready = new Set<string>();
  private retiring = new Map<string, Built>();
  private bar: Texture | null = null;
  private dim: { body: number; edges: number } | null = null;

  private constructor(app: Application, theme: Theme) {
    this.app = app;
    this.theme = theme;
    this.backend = app.renderer.name === 'webgpu' ? Backend.WebGPU : Backend.WebGL;
    this.grid = new TilingSprite({ texture: dotTexture(theme), width: app.screen.width, height: app.screen.height });
    this.textures = createTextureCache(() => this.invalidate());
    this.world.addChild(this.wires, this.cardLayer, this.overlay, this.peerLayer);
    app.stage.addChild(this.grid, this.world);
    this.loop();
  }

  static async create(host: HTMLElement, preference: Backend, theme: Theme): Promise<GpuScene> {
    const app = new Application();
    await app.init({
      preference,
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: devicePixelRatio,
      background: theme.canvas,
      autoStart: false
    });
    host.appendChild(app.canvas);
    app.canvas.dataset.testid = 'gpu-canvas';
    app.canvas.dataset.backend = app.renderer.name;
    return new GpuScene(app, theme);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  invalidate() {
    this.dirty = true;
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
    this.drawWires();
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
    this.drawWires();
    this.drawOverlay();
    this.invalidate();
  }

  setDim(dim: { body: number; edges: number } | null) {
    this.dim = dim;
    this.wires.alpha = dim ? dim.edges : 1;
    this.setCards(this.cards);
  }

  setWires(wires: Wire[]) {
    this.wiresIn = wires;
    this.drawWires();
    this.invalidate();
  }

  setOverlay(o: Overlay) {
    this.overlayIn = o;
    this.drawOverlay();
    this.drawPeers();
    this.invalidate();
  }

  resize() {
    this.app.resize();
    this.grid.width = this.app.screen.width;
    this.grid.height = this.app.screen.height;
    this.cull();
    this.invalidate();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    for (const id of [...this.built.keys()]) {
      this.drop(id);
    }
    this.textures.clear();
    this.app.destroy(true, { children: true });
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    if (!this.dirty && !this.playing.size) {
      return;
    }
    this.dirty = false;
    const t0 = performance.now();
    this.app.render();
    this.onFrame?.(performance.now() - t0);
  };

  private report() {
    this.onReady?.(new Set([...this.ready, ...this.retiring.keys()]));
  }

  private retire(old: Built | undefined, next: Built) {
    if (!old) {
      return;
    }
    if (!next.media) {
      this.destroyBuilt(old);
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
    b.root.destroy({ children: true });
  }

  private markReady(b: Built) {
    if (this.built.get(b.id) !== b) {
      return;
    }
    this.destroyBuilt(this.retiring.get(b.id));
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
    this.textures.want(this.imageUrl(media.url), (tex) => {
      if (sprite.destroyed) {
        return;
      }
      place(sprite, tex, box, fit);
      this.markReady(b);
    });
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
    const holder = new Container();
    const root = new Container();
    holder.addChild(root);
    const b: Built = { id: c.id, root: holder, skin: root, key, body: null, video: null, texts: [], media: null };
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
        g.rect(0, stage.h, c.w, 1).fill(this.theme.line);
        root.addChild(g);
        const media = f.live ? { url: f.live, video: true } : f.media;
        if (media) {
          this.mediaSprite(root, b, media, stage, Fit.Contain);
        }
        this.frameBar(root, b, c, stage.h, f.subtitle);
      },
      [Surface.Graphic]: () => f.media && this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h }, Fit.Contain),
      [Surface.Generate]: () => this.buildGenerate(root, b, c),
      [Surface.Text]: () => {
        this.panel(root, c);
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
          this.thumbGrid(root, f.thumbs, c, PAD + BODY_SIZE * 2);
          return;
        }
        const sub = this.text(f.subtitle, BODY_SIZE - 1, this.theme.inkSoft, c.w - PAD * 2);
        sub.position.set(PAD, PAD + BODY_SIZE * 2);
        root.addChild(sub);
        b.texts.push(sub);
      },
      [Surface.Blank]: () => this.panel(root, c)
    };
    BUILD[f.surface]();
    this.cardLayer.addChild(holder);
    return b;
  }

  private barTexture(): Texture {
    if (this.bar) {
      return this.bar;
    }
    const scale = BAR_ICON_SCALE;
    const w = BAR_BUTTON * ICON_PATHS.length * scale;
    const h = BAR_BUTTON * scale;
    const offset = ((BAR_BUTTON - BAR_ICON) / 2) * scale;
    const icons = ICON_PATHS.map((icon, i) => {
      const color = icon.accent ? this.theme.accent : this.theme.ink;
      const opacity = icon.dim ? 0.35 : 1;
      return `<g transform="translate(${i * BAR_BUTTON * scale + offset} ${offset}) scale(${(BAR_ICON * scale) / 24})" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.paths}</g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${icons}</svg>`;
    const img = new Image(w, h);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    this.bar = Texture.from(img);
    img.onload = () => {
      this.bar?.source.update();
      this.invalidate();
    };
    return this.bar;
  }

  private frameBar(root: Container, b: Built, c: Card, top: number, rev: string) {
    const g = new Graphics();
    g.rect(0, top, c.w, MOTION_NODE_BAR_H).fill(this.theme.paper);
    g.rect(0, top, c.w, 1).fill(this.theme.line);
    root.addChild(g);
    const icons = new Sprite(this.barTexture());
    icons.position.set(0, top);
    icons.width = BAR_BUTTON * ICON_PATHS.length;
    icons.height = BAR_BUTTON;
    root.addChild(icons);
    const label = this.text(rev, BODY_SIZE - 2, this.theme.ink, null);
    label.position.set(c.w - PAD / 2 - label.width, top + (MOTION_NODE_BAR_H - label.height) / 2);
    root.addChild(label);
    b.texts.push(label);
    const open = this.text(OPEN_LABEL, BODY_SIZE - 2, this.theme.ink, null);
    const pill = new Graphics();
    const pw = open.width + 16;
    const ph = open.height + 8;
    pill.rect(c.w - 6 - pw, 6, pw, ph).fill(this.theme.paper).stroke({ width: 1, color: this.theme.line });
    open.position.set(c.w - 6 - pw + 8, 10);
    root.addChild(pill, open);
    b.texts.push(open);
  }

  private thumbGrid(root: Container, urls: string[], c: Card, top: number) {
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
      this.textures.want(url, (tex) => {
        if (sprite.destroyed) {
          return;
        }
        sprite.texture = cover(tex, cell, cell);
        sprite.width = cell;
        sprite.height = cell;
      });
    });
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
    const v = this.visibleBox();
    let live = 0;
    for (const c of this.cards) {
      const b = this.built.get(c.id);
      if (!b) {
        continue;
      }
      const margin = 40 / this.view.zoom;
      const seen = c.x + c.w > v.x - margin && c.y + c.h > v.y - margin && c.x < v.x + v.w + margin && c.y < v.y + v.h + margin;
      b.root.visible = seen;
      for (const t of b.texts) {
        t.alpha = Math.max(0, Math.min(1, (Number(t.style.fontSize) * this.view.zoom - TEXT_FADE_FROM_PX) / TEXT_FADE_PX));
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
    for (const b of this.built.values()) {
      for (const t of b.texts) {
        t.resolution = tier;
      }
    }
  }

  private dashed(g: Graphics, c: Curve, color: string, width: number) {
    let run = 0;
    let on = true;
    let prev = c.from;
    g.moveTo(prev.x, prev.y);
    for (let i = 1; i <= DASH_SAMPLES; i++) {
      const p = curvePoint(c, i / DASH_SAMPLES);
      run += Math.hypot(p.x - prev.x, p.y - prev.y);
      if (on) {
        g.lineTo(p.x, p.y);
      } else {
        g.moveTo(p.x, p.y);
      }
      if (run >= (on ? DASH : GAP)) {
        if (on) {
          g.stroke({ width, color });
        }
        on = !on;
        run = 0;
        g.moveTo(p.x, p.y);
      }
      prev = p;
    }
    if (on) {
      g.stroke({ width, color });
    }
  }

  private drawWires() {
    const g = this.wires;
    g.clear();
    for (const w of this.wiresIn) {
      const color = w.iterate ? this.theme.iterate : w.selected ? this.theme.inkSoft : this.theme.wire;
      if (w.iterate) {
        this.dashed(g, w.curve, color, WIRE_WIDTH);
        g.circle(w.curve.mid.x, w.curve.mid.y, ITERATE_BADGE_R).fill(this.theme.paper).stroke({ width: BADGE_STROKE, color });
        this.repeatGlyph(g, w.curve.mid, ITERATE_BADGE_R * 0.5, color, BADGE_STROKE);
        continue;
      }
      const c = w.curve;
      g.moveTo(c.from.x, c.from.y).bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.to.x, c.to.y).stroke({ width: WIRE_WIDTH, color });
    }
  }

  private repeatGlyph(g: Graphics, at: { x: number; y: number }, r: number, color: string, width: number) {
    g.arc(at.x, at.y, r, -Math.PI * 0.9, Math.PI * 0.4).stroke({ width, color });
    g.arc(at.x, at.y, r, Math.PI * 0.1, Math.PI * 1.4).stroke({ width, color });
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
    for (const s of o.selected) {
      if (!o.resizable) {
        continue;
      }
      const k = CORNER_PX / z;
      for (const p of Object.values(cornersOf(s))) {
        g.rect(p.x - k / 2, p.y - k / 2, k, k).fill(this.theme.paper).stroke({ width: line, color: this.theme.accent });
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

const WIRE_INK_SHARE = 0.45;

function mix(a: string, b: string, share: number): string {
  try {
    return blend(a, b, share);
  } catch {
    return a;
  }
}

function blend(a: string, b: string, share: number): string {
  const ca = new Color(a).toRgb();
  const cb = new Color(b).toRgb();
  return new Color({ r: (ca.r * share + cb.r * (1 - share)) * 255, g: (ca.g * share + cb.g * (1 - share)) * 255, b: (ca.b * share + cb.b * (1 - share)) * 255 }).toHex();
}

export function themeOf(el: HTMLElement): Theme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    canvas: v('--ui-canvas', '#ebebeb'),
    dot: v('--ui-canvas-dot', '#c8c8c8'),
    paper: v('--paper', '#ffffff'),
    line: v('--line', '#e5e5e5'),
    ink: v('--ink', '#1d1d1f'),
    inkSoft: v('--ink-soft', '#6e6e73'),
    accent: v('--accent', '#7c5cff'),
    iterate: v('--ui-wire-iterate', '#d97706'),
    wire: mix(v('--ink-soft', '#6e6e73'), v('--paper', '#ffffff'), WIRE_INK_SHARE),
    font: (v('--sans', 'DM Sans').split(',')[0] || 'DM Sans').replace(/['"]/g, '').trim()
  };
}

export type { TextureCache };
