import type { MotionClip, MotionComp } from '@feega/motion-core/motion/doc';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };

type Axis = 'width' | 'height' | 'unit';

const SCALED: Record<string, Axis> = { x: 'width', width: 'width', y: 'height', height: 'height', size: 'unit' };
const SHIFTED: Record<string, keyof Point> = { x: 'x', y: 'y' };
const STILL: Point = { x: 0, y: 0 };

const unitOf = (size: Size) => Math.min(size.width, size.height);
const sideOf = (size: Size, axis: Axis) => (axis === 'unit' ? unitOf(size) : size[axis]);

export function compBox(comp: Pick<MotionComp, 'tracks'>, size: Size): Box | null {
  const boxes = comp.tracks
    .flatMap((t) => t.clips as MotionClip[])
    .filter((c) => !c.parent && Number(c.props.width) > 0 && Number(c.props.height) > 0)
    .map((c) => {
      const [x, y, w, h] = [c.props.x, c.props.y, c.props.width, c.props.height].map(Number);
      const [dx, dy] = [Number(c.transform?.x ?? 0), Number(c.transform?.y ?? 0)];
      return { left: (x - w / 2 + dx) * size.width, top: (y - h / 2 + dy) * size.height, right: (x + w / 2 + dx) * size.width, bottom: (y + h / 2 + dy) * size.height };
    });
  if (!boxes.length) {
    return null;
  }
  return { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
}

function mover(from: Size, to: Size, shift: Point) {
  const scale = (key: string, value: number) => (value * sideOf(from, SCALED[key])) / sideOf(to, SCALED[key]);
  const move = (key: string, value: number) => scale(key, value) + shift[SHIFTED[key]] / to[SCALED[key] as 'width' | 'height'];
  return { scale, move };
}

function reframedClip(clip: MotionClip, keys: { props: boolean; transform: boolean }, at: ReturnType<typeof mover>): MotionClip {
  const props = { ...clip.props };
  const transform = { ...clip.transform };
  const keyframes = { ...clip.keyframes };
  const viaProps = typeof props.x === 'number';

  for (const key of Object.keys(SCALED)) {
    const moved = SHIFTED[key] && (viaProps ? keys.props : false);
    const change = (v: number) => (moved ? at.move(key, v) : at.scale(key, v));
    if (typeof props[key] === 'number') {
      props[key] = change(props[key] as number);
    }
    if (keyframes[key]) {
      keyframes[key] = keyframes[key].map((k) => (typeof k.value === 'number' ? { ...k, value: change(k.value) } : k));
    }
  }

  for (const key of Object.keys(SHIFTED)) {
    const value = transform[key as keyof Point];
    const moved = !viaProps && keys.transform;
    if (typeof value === 'number' || moved) {
      transform[key as keyof Point] = moved ? at.move(key, value ?? 0) : at.scale(key, value ?? 0);
    }
  }

  return { ...clip, props, transform, keyframes };
}

export function reframed(comp: MotionComp, from: Size, to: Size, shift: Point = STILL): MotionComp {
  if (comp.frame || (from.width === to.width && from.height === to.height && !shift.x && !shift.y)) {
    return comp;
  }
  const at = mover(from, to, shift);
  const clips = comp.tracks.flatMap((t) => t.clips as MotionClip[]);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const carriedByParent = (clip: MotionClip): boolean => {
    const parent = clip.parent ? byId.get(clip.parent) : undefined;
    return parent ? typeof parent.props.x !== 'number' || carriedByParent(parent) : false;
  };
  const keysOf = (clip: MotionClip) => ({ props: !carriedByParent(clip), transform: !clip.parent });
  return { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => reframedClip(c, keysOf(c), at)) })) };
}
