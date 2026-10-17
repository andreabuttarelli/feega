import { Application, Color, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite, VideoSource } from 'pixi8';
import type { Viewport } from '../dot-grid';
import { CONNECTOR_STYLE } from '../connectors';
import { LOD_ZOOM } from '../poster-lod';
import { AssetSize, sized } from '../asset-url';
import { Surface, type CardFace, type Media } from './card-face';
import { cornersOf, curvePoint, PORT_SIZE, type Box, type Curve, type Port } from './geometry';
import { createTextureCache, type TextureCache } from './texture-cache';
import { Backend } from './backend';

export { Backend };


export type Card = Box & { id: string; face: CardFace; rotation: number; ports: Port[]; hidden: boolean };
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

const LABEL_GAP = 6;
const LABEL_SIZE = 12;
const PAD = 14;
const BODY_SIZE = 13;
const CORNER_PX = 8;
const DOT_TILE = 24;
const DASH = 6;
const GAP = 4;
const DASH_SAMPLES = 64;
const ITERATE_BADGE_R = 11;
const LIVE_VIDEO_CAP = 4;
const NEAR_TIER_ZOOM = 0.75;
const MAX_TEXT_CHARS = 1400;
const TEXT_TIERS = [1, 2, 4] as const;
const THUMB_COLUMNS = 3;
const THUMB_GAP = 4;

const tierFor = (zoom: number) => TEXT_TIERS.find((t) => t >= zoom * devicePixelRatio) ?? TEXT_TIERS[TEXT_TIERS.length - 1];

type Built = { root: Container; skin: Container; key: string; body: Sprite | null; video: HTMLVideoElement | null; texts: Text[]; label: Text | null; media: Media | null };

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
        this.drop(c.id);
        b = this.build(c, key);
        this.built.set(c.id, b);
      }
      b.root.position.set(c.x, c.y);
      b.root.pivot.set(0, 0);
      b.root.angle = c.rotation;
      b.skin.visible = !c.hidden;
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

  private drop(id: string) {
    const b = this.built.get(id);
    if (!b) {
      return;
    }
    if (b.video) {
      b.video.pause();
      this.playing.delete(b.video);
      b.video.removeAttribute('src');
      b.video.load();
    }
    b.root.destroy({ children: true });
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

  private mediaSprite(root: Container, b: Built, media: Media, box: Box) {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.position.set(box.x, box.y);
    sprite.width = box.w;
    sprite.height = box.h;
    root.addChild(sprite);
    b.body = sprite;
    b.media = media;
    if (media.video) {
      this.attachVideo(b, media.url, box);
      return;
    }
    this.textures.want(this.imageUrl(media.url), (tex) => {
      if (sprite.destroyed) {
        return;
      }
      sprite.texture = cover(tex, box.w, box.h);
      sprite.width = box.w;
      sprite.height = box.h;
    });
  }

  private imageUrl(url: string): string {
    return sized(url, this.view.zoom >= NEAR_TIER_ZOOM ? AssetSize.Px1024 : AssetSize.Px256);
  }

  private attachVideo(b: Built, url: string, box: Box) {
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
      b.body.texture = cover(new Texture({ source }), box.w, box.h);
      b.body.width = box.w;
      b.body.height = box.h;
      this.cull();
      this.invalidate();
    });
  }

  private build(c: Card, key: string): Built {
    const holder = new Container();
    const root = new Container();
    holder.addChild(root);
    const b: Built = { root: holder, skin: root, key, body: null, video: null, texts: [], label: null, media: null };
    const f = c.face;
    const BUILD: Record<Surface, () => void> = {
      [Surface.Media]: () => f.media && this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h }),
      [Surface.Frame]: () => {
        this.panel(root, c, false);
        if (f.live) {
          this.mediaSprite(root, b, { url: f.live, video: true }, { x: 0, y: 0, w: c.w, h: c.h });
          return;
        }
        if (f.media) {
          this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h });
        }
      },
      [Surface.Graphic]: () => f.media && this.mediaSprite(root, b, f.media, { x: 0, y: 0, w: c.w, h: c.h }),
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
    if (f.label) {
      const label = this.text(f.label, LABEL_SIZE, this.theme.inkSoft, null, '600');
      label.position.set(0, -LABEL_SIZE * 1.4 - LABEL_GAP);
      holder.addChild(label);
      b.texts.push(label);
      b.label = label;
    }
    this.drawPorts(holder, c);
    this.cardLayer.addChild(holder);
    return b;
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

  private drawPorts(root: Container, c: Card) {
    const typed = c.ports.filter((p) => p.port);
    if (!typed.length) {
      return;
    }
    const g = new Graphics();
    const half = PORT_SIZE / 2;
    for (const p of typed) {
      g.rect(p.x - c.x - half, p.y - c.y - half, PORT_SIZE, PORT_SIZE).fill(CONNECTOR_STYLE[p.port!].color);
    }
    root.addChild(g);
  }

  private visibleBox(): Box {
    const z = this.view.zoom;
    return { x: -this.view.x / z, y: -this.view.y / z, w: this.app.screen.width / z, h: this.app.screen.height / z };
  }

  private cull() {
    const v = this.visibleBox();
    const near = this.view.zoom >= LOD_ZOOM;
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
        t.visible = near;
      }
      if (!b.video) {
        continue;
      }
      const play = seen && near && !c.hidden && live < LIVE_VIDEO_CAP;
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
    const step = 1 / DASH_SAMPLES;
    let drawn = 0;
    let on = true;
    let prev = c.from;
    g.moveTo(prev.x, prev.y);
    for (let t = step; t <= 1 + 1e-9; t += step) {
      const p = curvePoint(c, t);
      drawn += Math.hypot(p.x - prev.x, p.y - prev.y) * this.view.zoom;
      if (on) {
        g.lineTo(p.x, p.y);
      } else {
        g.moveTo(p.x, p.y);
      }
      if (drawn >= (on ? DASH : GAP)) {
        on = !on;
        drawn = 0;
      }
      prev = p;
    }
    g.stroke({ width, color });
  }

  private drawWires() {
    const g = this.wires;
    g.clear();
    const width = 1.5 / this.view.zoom;
    for (const w of this.wiresIn) {
      const color = w.iterate ? this.theme.iterate : w.selected ? this.theme.inkSoft : this.theme.wire;
      if (w.iterate) {
        this.dashed(g, w.curve, color, width);
        const r = ITERATE_BADGE_R / this.view.zoom;
        g.circle(w.curve.mid.x, w.curve.mid.y, r).fill(this.theme.paper).stroke({ width, color });
        this.repeatGlyph(g, w.curve.mid, r * 0.5, color, width);
        continue;
      }
      const c = w.curve;
      g.moveTo(c.from.x, c.from.y).bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.to.x, c.to.y).stroke({ width: w.selected ? width * 1.6 : width, color });
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
      g.rect(s.x, s.y, s.w, s.h).stroke({ width: line * 1.4, color: this.theme.accent });
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
