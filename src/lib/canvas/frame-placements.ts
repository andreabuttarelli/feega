import { placerAt, type Corner, type Placed, type Placer, type Prepared } from '@feega/motion-core/motion/gpu-full/display-list';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import { ancestorsOf } from '@feega/motion-core/motion/parent';
import { SEPARATOR } from '@feega/motion-core/motion/precomp';

export type FrameRect = { left: number; top: number; width: number; height: number };

export type Quad = Placed['corners'];

const HOST = 'Precomp';
const CELL = 256;
const PATH_STEP = 2;

const cellOf = (v: number) => Math.floor(v / CELL);
const keyOf = (cx: number, cy: number) => `${cx},${cy}`;

function inside(polygon: readonly Corner[], [x, y]: Corner): boolean {
  let positive = false;
  let negative = false;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    const turn = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    positive ||= turn > 0;
    negative ||= turn < 0;
  }
  return !positive || !negative;
}

const doubleArea = (polygon: readonly Corner[]): number => polygon.reduce((sum, [x, y], i) => sum + x * polygon[(i + 1) % polygon.length][1] - polygon[(i + 1) % polygon.length][0] * y, 0);

const covers = (polygon: readonly Corner[], p: Corner): boolean => doubleArea(polygon) !== 0 && inside(polygon, p);

const holds = (placed: Placed, p: Corner) => covers(placed.corners, p) && placed.cuts.every((cut) => covers(cut, p));

function spanOf(corners: readonly Corner[]): FrameRect {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

const turned = ([x, y]: Corner, cos: number, sin: number): Corner => [x * cos - y * sin, x * sin + y * cos];

const pathOfOwner = (owner: string) => owner.split(SEPARATOR).filter((_, i) => i % PATH_STEP === 0);

const samePath = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export class FramePlacements {
  readonly #prepared: Prepared;
  readonly #placer: Placer;
  readonly #placed = new Map<string, Placed | null>();
  readonly #owners = new Map<string, string[]>();
  #hosts: ReadonlySet<string> | null = null;
  #members: Map<string, string[]> | null = null;
  #cells: Map<string, number[]> | null = null;

  constructor(prepared: Prepared, frame: number) {
    this.#prepared = prepared;
    this.#placer = placerAt(prepared, frame);
  }

  ownersOf(clipId: string): string[] {
    const held = this.#owners.get(clipId);
    if (held) {
      return held;
    }
    const owners = [...ancestorsOf(this.#prepared.doc, clipId).filter((id) => this.#hostIds().has(id)), clipId];
    this.#owners.set(clipId, owners);
    return owners;
  }

  stackAt(point: Corner): string[] {
    return this.#holding(point)
      .map((p) => p.clip)
      .reverse();
  }

  ownersAt(point: Corner): string[] {
    const top = this.#holding(point).at(-1);
    return top ? this.ownersOf(top.clip) : [];
  }

  rectOf(clip: string): FrameRect | null {
    const corners = this.#membersOf(clip).flatMap((p) => p.corners);
    return corners.length ? spanOf(corners) : null;
  }

  quadOf(clip: string): Quad | null {
    const drawn = this.#membersOf(clip);
    if (!drawn.length) {
      return null;
    }
    const own = drawn.find((p) => p.clip === clip)?.corners;
    const angle = own ? Math.atan2(own[1][1] - own[0][1], own[1][0] - own[0][0]) : 0;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const r = spanOf(drawn.flatMap((p) => p.corners).map((c) => turned(c, cos, -sin)));
    const corners: Quad = [
      [r.left, r.top],
      [r.left + r.width, r.top],
      [r.left + r.width, r.top + r.height],
      [r.left, r.top + r.height]
    ];
    return angle ? (corners.map((c) => turned(c, cos, sin)) as Quad) : corners;
  }

  pathRect(path: readonly string[]): FrameRect | null {
    const corners = this.#all()
      .filter((p) => this.ownersOf(p.clip).some((owner) => samePath(pathOfOwner(owner), path)))
      .flatMap((p) => p.corners);
    return corners.length ? spanOf(corners) : null;
  }

  leafRects(): Record<string, FrameRect> {
    return Object.fromEntries(this.#all().filter((p) => p.opacity > 0).map((p) => [p.clip, spanOf(p.corners)]));
  }

  #hostIds(): ReadonlySet<string> {
    this.#hosts ??= new Set(this.#prepared.doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.component === HOST).map((c) => c.id)));
    return this.#hosts;
  }

  #place(clipId: string): Placed | null {
    if (!this.#placed.has(clipId)) {
      this.#placed.set(clipId, this.#placer.place(clipId));
    }
    return this.#placed.get(clipId)!;
  }

  #all(): Placed[] {
    return this.#placer.drawn.flatMap((id) => this.#place(id) ?? []);
  }

  #membersOf(clip: string): Placed[] {
    if (!this.#members) {
      this.#members = new Map();
      for (const id of this.#placer.drawn) {
        for (const owner of this.ownersOf(id)) {
          this.#members.set(owner, this.#members.get(owner)?.concat(id) ?? [id]);
        }
      }
    }
    return (this.#members.get(clip) ?? []).flatMap((id) => this.#place(id) ?? []);
  }

  #holding(point: Corner): Placed[] {
    const drawn = this.#all();
    const bucket = this.#index(drawn).get(keyOf(cellOf(point[0]), cellOf(point[1]))) ?? [];
    return bucket.map((order) => drawn[order]).filter((p) => holds(p, point));
  }

  #index(drawn: Placed[]): Map<string, number[]> {
    if (this.#cells) {
      return this.#cells;
    }
    const cells = new Map<string, number[]>();
    drawn.forEach((p, order) => {
      const r = spanOf(p.corners);
      if (p.opacity <= 0 || !Number.isFinite(r.width + r.height + r.left + r.top)) {
        return;
      }
      for (let cx = cellOf(r.left); cx <= cellOf(r.left + r.width); cx++) {
        for (let cy = cellOf(r.top); cy <= cellOf(r.top + r.height); cy++) {
          const key = keyOf(cx, cy);
          cells.set(key, cells.get(key)?.concat(order) ?? [order]);
        }
      }
    });
    this.#cells = cells;
    return cells;
  }
}
