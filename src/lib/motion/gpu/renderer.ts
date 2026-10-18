import 'pixi8/advanced-blend-modes';
import { Application, BlurFilter, Container, Graphics, Matrix, PerspectiveMesh, Sprite, Texture, type BLEND_MODES } from 'pixi8';
import { Backend } from '../../canvas/gpu/backend';
import { isAffine, project } from './matrix';
import type { Drawn, Point, Quad } from './scene';
import type { Size } from './matrix';

export type Placement = { texture: Texture; rect: [number, number, number, number] };

export enum SlotKind {
  Native = 'native',
  Run = 'run'
}

export type Slot = { kind: SlotKind.Native; drawn: Drawn; placement: Placement } | { kind: SlotKind.Run; texture: Texture; blend: string };

const MESH_STEPS = 12;
const BLUR_QUALITY = 6;
const VISIBLE_BLUR = 0.05;

export type GpuRenderer = { canvas: HTMLCanvasElement; backend: string; draw: (slots: Slot[]) => void; destroy: () => void };

function placed(d: Drawn, p: Placement): Container {
  const [x, y, w, h] = p.rect;
  if (isAffine(d.matrix)) {
    const sprite = new Sprite(p.texture);
    const m = d.matrix;
    const local = new Matrix(w / p.texture.width, 0, 0, h / p.texture.height, x, y);
    sprite.setFromMatrix(new Matrix(m[0], m[1], m[4], m[5], m[12], m[13]).append(local));
    return sprite;
  }
  const corners: Point[] = [project(d.matrix, x, y), project(d.matrix, x + w, y), project(d.matrix, x + w, y + h), project(d.matrix, x, y + h)];
  return new PerspectiveMesh({ texture: p.texture, verticesX: MESH_STEPS, verticesY: MESH_STEPS, x0: corners[0][0], y0: corners[0][1], x1: corners[1][0], y1: corners[1][1], x2: corners[2][0], y2: corners[2][1], x3: corners[3][0], y3: corners[3][1] });
}

function clipped(inner: Container, quads: Quad[]): Container {
  return quads.reduce((child, quad) => {
    const holder = new Container();
    const shape = new Graphics().poly(quad.flat()).fill(0xffffff);
    holder.addChild(shape, child);
    child.mask = shape;
    return holder;
  }, inner);
}

function styled(node: Container, d: Drawn): Container {
  node.alpha = d.opacity;
  if (d.blur > VISIBLE_BLUR) {
    node.filters = [new BlurFilter({ strength: d.blur, quality: BLUR_QUALITY })];
  }
  const out = clipped(node, d.clips);
  out.blendMode = d.blend as BLEND_MODES;
  return out;
}

export async function createRenderer(frame: Size, preference: Backend = Backend.WebGPU, resolution = 1): Promise<GpuRenderer> {
  const app = new Application();
  await app.init({ preference, width: frame.width, height: frame.height, backgroundAlpha: 0, antialias: true, useBackBuffer: true, preserveDrawingBuffer: true, autoStart: false, resolution });
  app.canvas.dataset.engine = 'gpu';
  const NODE: Record<SlotKind, (slot: Slot) => Container> = {
    [SlotKind.Native]: (slot) => {
      const { drawn, placement } = slot as Extract<Slot, { kind: SlotKind.Native }>;
      return styled(placed(drawn, placement), drawn);
    },
    [SlotKind.Run]: (slot) => {
      const run = slot as Extract<Slot, { kind: SlotKind.Run }>;
      const sprite = new Sprite(run.texture);
      sprite.setSize(frame.width, frame.height);
      sprite.blendMode = run.blend as BLEND_MODES;
      return sprite;
    }
  };
  const draw = (slots: Slot[]) => {
    for (const child of app.stage.removeChildren()) {
      child.destroy({ children: true });
    }
    for (const slot of slots) {
      app.stage.addChild(NODE[slot.kind](slot));
    }
    app.render();
  };
  return { canvas: app.canvas, backend: app.renderer.name, draw, destroy: () => app.destroy(true, { children: true, texture: true }) };
}
