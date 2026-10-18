import { Container, Graphics, Sprite, Text, Texture } from 'pixi8';
import { PORT_SIZE } from './geometry';
import { chromeKey, type IdleChrome } from './idle-chrome';

export type Placed = { id: string; x: number; y: number; w: number; h: number; rotation: number; chrome: IdleChrome | null };
export type ChromeLook = { font: string; ink: string; size: number };

const ICON_PX = 12;
const ICON_GAP = 5;
const LABEL_GAP = 4;
const LABEL_LINE = 1.3;
const LABEL_PAD = 2;

type Drawn = { key: string; kind: string | null; root: Container; label: Text | null };

export class ChromeLayer {
  readonly root = new Container();
  private drawn = new Map<string, Drawn>();
  private icons = new Map<string, Texture>();
  private tier = 1;

  constructor(private look: ChromeLook) {}

  setIcon(kind: string, source: ImageBitmap | HTMLImageElement) {
    this.icons.set(kind, Texture.from(source));
    for (const [id, d] of this.drawn) {
      if (d.kind === kind) {
        this.discard(id);
      }
    }
  }

  setTier(tier: number) {
    this.tier = tier;
    for (const d of this.drawn.values()) {
      if (d.label) {
        d.label.resolution = tier;
      }
    }
  }

  set(cards: readonly Placed[], visible: (c: Placed) => boolean) {
    const seen = new Set<string>();
    for (const c of cards) {
      if (!c.chrome) {
        continue;
      }
      seen.add(c.id);
      const key = chromeKey(c.chrome) + (this.icons.has(c.chrome.kind ?? '') ? ':icon' : '');
      let d = this.drawn.get(c.id);
      if (!d || d.key !== key) {
        this.discard(c.id);
        d = this.draw(c.chrome, key);
        this.drawn.set(c.id, d);
        this.root.addChild(d.root);
      }
      d.root.pivot.set(c.w / 2, c.h / 2);
      d.root.position.set(c.x + c.w / 2, c.y + c.h / 2);
      d.root.angle = c.rotation;
      d.root.visible = visible(c);
    }
    for (const id of [...this.drawn.keys()]) {
      if (!seen.has(id)) {
        this.discard(id);
      }
    }
  }

  destroy() {
    for (const id of [...this.drawn.keys()]) {
      this.discard(id);
    }
    this.root.destroy();
  }

  private discard(id: string) {
    this.drawn.get(id)?.root.destroy({ children: true });
    this.drawn.delete(id);
  }

  private draw(c: IdleChrome, key: string): Drawn {
    const root = new Container();
    const g = new Graphics();
    for (const p of c.ports) {
      g.rect(p.x, p.y, PORT_SIZE, PORT_SIZE).fill(p.color);
    }
    root.addChild(g);
    const label = c.label ? this.label(root, c) : null;
    return { key, kind: c.kind, root, label };
  }

  private label(root: Container, c: IdleChrome): Text {
    const height = this.look.size * LABEL_LINE;
    const top = -LABEL_GAP - LABEL_PAD - height;
    const icon = c.kind ? this.icons.get(c.kind) : undefined;
    let left = 0;
    if (icon) {
      const s = new Sprite(icon);
      s.tint = this.look.ink;
      s.width = ICON_PX;
      s.height = ICON_PX;
      s.position.set(0, top + (height - ICON_PX) / 2);
      root.addChild(s);
      left = ICON_PX + ICON_GAP;
    }
    const t = new Text({
      text: c.label!,
      resolution: this.tier,
      style: { fontFamily: this.look.font, fontSize: this.look.size, fill: this.look.ink, lineHeight: height }
    });
    t.position.set(left, top);
    const room = c.w - left;
    if (t.width > room) {
      const mask = new Graphics().rect(left, top, room, height).fill(0xffffff);
      root.addChild(mask);
      t.mask = mask;
    }
    root.addChild(t);
    return t;
  }
}
