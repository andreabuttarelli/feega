import { Ease } from '@feega/motion-core/motion/design';
import { ElementState, MAX_STATE_MS, stateRowSchema, type OverrideKey, type StateRow } from '@feega/motion-core/motion/states/model';
import type { RestNode } from '$lib/server/figma/rest-message';

type Hover = NonNullable<RestNode['hover']>;
type Bezier = [number, number, number, number];

const CSS_EASES: Record<string, Ease | Bezier> = {
  linear: Ease.Linear,
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1]
};

const BEZIER = /^cubic-bezier\(([^)]+)\)$/;
const RGB = /^rgba?\(([^)]+)\)$/;
const OPAQUE = 1;
const BYTE = 255;
const HEX = 16;

const isText = (n: RestNode) => n.type === 'TEXT';

const FIELDS: { key: OverrideKey; of: (n: RestNode, h: Hover) => string | number | undefined }[] = [
  { key: 'fill', of: (n, h) => (isText(n) ? h.color : h.fill) },
  { key: 'stroke', of: (n, h) => (!isText(n) && n.strokes?.length ? h.stroke : undefined) },
  { key: 'opacity', of: (_n, h) => h.opacity },
  { key: 'scale', of: (_n, h) => h.scale }
];

const COLOURS = new Set<OverrideKey>(['fill', 'stroke']);

function hexOf(css: string): string | undefined {
  const parts = css.match(RGB)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (!parts || parts.length < 3 || parts.some((p) => !Number.isFinite(p))) {
    return undefined;
  }
  const [r, g, b, a = OPAQUE] = parts;
  const bytes = [r, g, b, ...(a < OPAQUE ? [Math.round(a * BYTE)] : [])];
  return `#${bytes.map((v) => Math.round(v).toString(HEX).padStart(2, '0')).join('')}`;
}

function easingOf(css: string): Ease | Bezier {
  const bezier = css.match(BEZIER)?.[1].split(',').map(Number);
  if (bezier?.length === 4 && bezier.every(Number.isFinite)) {
    return bezier as Bezier;
  }
  return CSS_EASES[css] ?? Ease.Standard;
}

function rowOf(n: RestNode, hover: Hover): StateRow | null {
  const overrides = Object.fromEntries(
    FIELDS.flatMap(({ key, of }) => {
      const raw = of(n, hover);
      const value = typeof raw === 'string' && COLOURS.has(key) ? hexOf(raw) : raw;
      return value === undefined ? [] : [[key, value]];
    })
  );
  if (!Object.keys(overrides).length) {
    return null;
  }
  const row = stateRowSchema.safeParse({ state: ElementState.Hover, overrides, transition: { easing: easingOf(hover.easing), durationMs: Math.min(MAX_STATE_MS, Math.round(hover.durationMs)) } });
  return row.success ? row.data : null;
}

export function withHoverStates(n: RestNode): RestNode {
  const { hover, ...rest } = n;
  const row = hover ? rowOf(rest, hover) : null;
  const behaved = row ? { ...rest, behaviour: { ...rest.behaviour, states: [row] } } : rest;
  return n.children ? { ...behaved, children: n.children.map(withHoverStates) } : behaved;
}
