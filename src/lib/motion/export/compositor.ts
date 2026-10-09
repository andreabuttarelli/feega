import type { Effect, LayerNode, LayerTree, Paint, Rgba } from '../hyperframes/layer-tree';

export type Device<S, F = S> = {
  surface: () => S;
  release: (s: S) => void;
  fill: (s: S, rgba: Rgba) => void;
  paint: (s: S, p: Paint) => void;
  effect: (s: S, e: Effect) => S;
  mask: (s: S, by: S) => S;
  blend: (into: S, from: S, opacity: number, mode: string) => void;
  finish: (s: S) => F;
};

const NORMAL = 'normal';

const isolated = (n: LayerNode) => n.effects.length > 0 || n.opacity < 1 || n.blend !== NORMAL;

export function composite<S, F>(device: Device<S, F>, tree: LayerTree): F {
  const clipped = (n: LayerNode, into: S, clip: Paint) => {
    let held = device.surface();
    n.children.forEach((c) => draw(c, held));
    const shape = device.surface();
    device.paint(shape, clip);
    held = device.mask(held, shape);
    device.release(shape);
    device.blend(into, held, 1, NORMAL);
    device.release(held);
  };
  const contents = (n: LayerNode, into: S) => {
    n.paints.forEach((p) => device.paint(into, p));
    if (n.clip) {
      clipped(n, into, n.clip);
      return;
    }
    n.children.forEach((c) => draw(c, into));
  };
  const draw = (n: LayerNode, into: S) => {
    if (!isolated(n)) {
      contents(n, into);
      return;
    }
    let own = device.surface();
    contents(n, own);
    for (const e of n.effects) {
      own = device.effect(own, e);
    }
    device.blend(into, own, n.opacity, n.blend);
    device.release(own);
  };

  const frame = device.surface();
  if (tree.backdrop) {
    device.fill(frame, tree.backdrop);
  }
  draw(tree.root, frame);
  return device.finish(frame);
}
