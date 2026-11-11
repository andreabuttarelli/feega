import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';

export type LookValue = string | number;

export type CodeSpot = { at: string; tag: string; cls: string; cond?: string };
export type Look = Record<string, LookValue>;

export enum LookKey {
  Text = 'text',
  Color = 'color',
  Fill = 'fill',
  Size = 'size',
  Gap = 'gap',
  Padding = 'padding',
  Direction = 'direction'
}

type Fills = { type?: string; color?: string }[];
type LookRule = { read: (clip: MotionClip, minSide: number) => LookValue | undefined; write: (clip: MotionClip, value: LookValue, minSide: number) => MotionClip; css: ((value: LookValue) => [string, string]) | null };

const TENTHS = 10;
const tenths = (n: number) => Math.round(n * TENTHS) / TENTHS;
const isText = (clip: MotionClip) => clip.component === 'Text';
const stringProp = (clip: MotionClip, key: string) => (typeof clip.props[key] === 'string' ? (clip.props[key] as string) : undefined);

const FLEX: Partial<Record<Direction, string>> = { [Direction.Horizontal]: 'row', [Direction.Vertical]: 'column' };
const DIRECTION_OF: Record<string, Direction> = { row: Direction.Horizontal, column: Direction.Vertical };

const withProp = (clip: MotionClip, key: string, value: unknown): MotionClip => ({ ...clip, props: { ...clip.props, [key]: value } });
const withLayout = (clip: MotionClip, patch: Partial<NonNullable<MotionClip['autoLayout']>>): MotionClip => (clip.autoLayout ? { ...clip, autoLayout: { ...clip.autoLayout, ...patch } } : clip);
const solidOf = (clip: MotionClip) => {
  const first = (clip.props.fills as Fills | undefined)?.[0];
  return first?.type === 'solid' ? first.color : undefined;
};
const withSolid = (clip: MotionClip, color: string): MotionClip => {
  const fills = clip.props.fills as Fills | undefined;
  return fills?.length ? withProp(clip, 'fills', [{ ...fills[0], color }, ...fills.slice(1)]) : clip;
};
const PX = /(-?\d+(?:\.\d+)?)px/g;
const paddingOf = (value: LookValue) => {
  const [top = 0, right = 0, bottom = 0, left = 0] = [...String(value).matchAll(PX)].map((m) => Number(m[1]));
  return { top, right, bottom, left };
};

export const LOOK: Record<LookKey, LookRule> = {
  [LookKey.Text]: { read: (c) => (isText(c) ? stringProp(c, 'text') : undefined), write: (c, v) => withProp(c, 'text', String(v)), css: null },
  [LookKey.Color]: { read: (c) => (isText(c) ? (solidOf(c) ?? stringProp(c, 'color')) : undefined), write: (c, v) => withSolid(withProp(c, 'color', String(v)), String(v)), css: (v) => ['color', String(v)] },
  [LookKey.Fill]: {
    read: (c) => (isText(c) ? undefined : solidOf(c)),
    write: (c, v) => withSolid(c, String(v)),
    css: (v) => ['background-color', String(v)]
  },
  [LookKey.Size]: { read: (c, side) => (isText(c) && typeof c.props.size === 'number' ? tenths(c.props.size * side) : undefined), write: (c, v, side) => withProp(c, 'size', Number(v) / side), css: (v) => ['font-size', `${v}px`] },
  [LookKey.Gap]: { read: (c) => c.autoLayout?.gap, write: (c, v) => withLayout(c, { gap: Number(v) }), css: (v) => ['gap', `${v}px`] },
  [LookKey.Padding]: {
    read: (c) => {
      const p = c.autoLayout?.padding;
      return p ? `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px` : undefined;
    },
    write: (c, v) => withLayout(c, { padding: paddingOf(v) }),
    css: (v) => ['padding', String(v)]
  },
  [LookKey.Direction]: { read: (c) => (c.autoLayout ? FLEX[c.autoLayout.direction] : undefined), write: (c, v) => (DIRECTION_OF[String(v)] ? withLayout(c, { direction: DIRECTION_OF[String(v)] }) : c), css: (v) => ['flex-direction', String(v)] }
};

export const minSideOf = (doc: Pick<MotionDoc, 'width' | 'height'>) => Math.min(doc.width, doc.height);

export function lookOf(clip: MotionClip, minSide: number): Look {
  const look: Look = {};
  for (const key of Object.values(LookKey)) {
    const value = LOOK[key].read(clip, minSide);
    if (value !== undefined) {
      look[key] = value;
    }
  }
  return look;
}

export function changedLook(clip: MotionClip, minSide: number): Look {
  const was = clip.source?.was ?? {};
  const now = lookOf(clip, minSide);
  const changed: Look = {};
  for (const [key, value] of Object.entries(now)) {
    if (key in was && was[key] !== value) {
      changed[key] = value;
    }
  }
  return changed;
}

export function mapClips(doc: MotionDoc, edit: (clip: MotionClip) => MotionClip): MotionDoc {
  const tracks = (list: MotionDoc['tracks']) => list.map((t) => ({ ...t, clips: t.clips.map((c) => edit(c as MotionClip)) }));
  return { ...doc, tracks: tracks(doc.tracks), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: tracks(comp.tracks) }])) };
}

export function baselined(doc: MotionDoc): MotionDoc {
  const side = minSideOf(doc);
  return mapClips(doc, (c) => (c.source ? { ...c, source: { ...c.source, was: lookOf(c, side) } } : c));
}
