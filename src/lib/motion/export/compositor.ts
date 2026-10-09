import { EffectKind, type Effect, type LayerNode, type LayerTree, type Mask, type MaskComposite, type Paint, type Rgba } from '../hyperframes/layer-tree';

export type Rect = [number, number, number, number];

export type Device<S, F = S> = {
  surface: () => S;
  release: (s: S) => void;
  region: (r: Rect | null) => void;
  fill: (s: S, rgba: Rgba) => void;
  paint: (s: S, p: Paint) => void;
  effect: (s: S, e: Effect) => S;
  combine: (src: S, dst: S, op: MaskComposite) => S;
  mask: (s: S, by: S) => S;
  blend: (into: S, from: S, opacity: number, mode: string) => void;
  finish: (s: S) => F;
};

const NORMAL = 'normal';

const isolated = (n: LayerNode) => n.effects.length > 0 || n.masks.length > 0 || n.opacity < 1 || n.blend !== NORMAL;

function quad(p: Paint): Rect | null {
  if (!p.width || !p.height) {
    return null;
  }
  const [a, b, c, d, e, f] = p.at;
  const xs = [e, a * p.width + e, c * p.height + e, a * p.width + c * p.height + e];
  const ys = [f, b * p.width + f, d * p.height + f, b * p.width + d * p.height + f];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function union(rects: (Rect | null)[]): Rect | null {
  const found = rects.filter((r): r is Rect => r !== null);
  return found.length ? [Math.min(...found.map((r) => r[0])), Math.min(...found.map((r) => r[1])), Math.max(...found.map((r) => r[2])), Math.max(...found.map((r) => r[3]))] : null;
}

function within(r: Rect | null, limit: Rect | null): Rect | null {
  if (!r || !limit) {
    return null;
  }
  const out: Rect = [Math.max(r[0], limit[0]), Math.max(r[1], limit[1]), Math.min(r[2], limit[2]), Math.min(r[3], limit[3])];
  return out[2] > out[0] && out[3] > out[1] ? out : null;
}

const GAUSS_REACH = 3;

const REACH: Record<EffectKind, (e: Effect) => number> = {
  [EffectKind.Grain]: () => 0,
  [EffectKind.Blur]: (e) => GAUSS_REACH * (e as Extract<Effect, { kind: EffectKind.Blur }>).sigma
};

function grown(r: Rect | null, by: number): Rect | null {
  return r && [r[0] - by, r[1] - by, r[2] + by, r[3] + by];
}

const boundsOf = (n: LayerNode): Rect | null =>
  grown(
    union([...n.paints.map(quad), ...n.children.map(boundsOf)]),
    n.effects.reduce((sum, e) => sum + REACH[e.kind](e), 0)
  );

export function composite<S, F>(device: Device<S, F>, tree: LayerTree): F {
  const frame: Rect = [-tree.pad, -tree.pad, tree.width + tree.pad, tree.height + tree.pad];
  let current: Rect | null = null;
  const scoped = (r: Rect | null, work: () => void) => {
    const outer = current;
    const inner = within(r && [Math.floor(r[0]), Math.floor(r[1]), Math.ceil(r[2]), Math.ceil(r[3])], outer ?? frame);
    if (!inner) {
      return;
    }
    current = inner;
    device.region(inner);
    work();
    current = outer;
    device.region(outer);
  };
  const shaped = (p: Paint) => {
    const s = device.surface();
    device.paint(s, p);
    return s;
  };
  const coverage = (masks: Mask[]) => {
    let acc = shaped(masks[masks.length - 1].paint);
    for (let i = masks.length - 2; i >= 0; i--) {
      const top = shaped(masks[i].paint);
      acc = device.combine(top, acc, masks[i].composite);
      device.release(top);
    }
    return acc;
  };
  const clipped = (n: LayerNode, into: S, clip: Paint) => {
    scoped(within(union(n.children.map(boundsOf)), quad(clip)), () => {
      let held = device.surface();
      n.children.forEach((c) => draw(c, held));
      const shape = shaped(clip);
      held = device.mask(held, shape);
      device.release(shape);
      device.blend(into, held, 1, NORMAL);
      device.release(held);
    });
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
    scoped(boundsOf(n), () => {
      let own = device.surface();
      contents(n, own);
      for (const e of n.effects) {
        own = device.effect(own, e);
      }
      if (n.masks.length) {
        const by = coverage(n.masks);
        own = device.mask(own, by);
        device.release(by);
      }
      device.blend(into, own, n.opacity, n.blend);
      device.release(own);
    });
  };

  const out = device.surface();
  if (tree.backdrop) {
    device.fill(out, tree.backdrop);
  }
  draw(tree.root, out);
  return device.finish(out);
}
