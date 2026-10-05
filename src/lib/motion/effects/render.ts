import { ValueKind, sampleColor, sampleTrack, type Keyframes } from '../keyframes';
import { esc, js } from '../hyperframes/html';
import { EFFECTS, type Rendered, type SvgNode, type Values } from './registry';
import { effectKey, paramValues, type Effect } from './model';

type Frame = { width: number; height: number; fps: number };
type EffectClip = { id: string; from: number; durationInFrames: number; keyframes: Keyframes; effects: Effect[] };
type Resolve = (colour: string) => string;

export type EffectSet = { target: string; vars: Record<string, unknown>; at: number };

export const EFFECT_CSS = '.ef{position:absolute;inset:0}.efd{position:absolute;width:0;height:0;overflow:hidden}';

const layerId = (clip: EffectClip) => `ef-${clip.id}`;
const filterId = (clip: EffectClip, effect: Effect) => `ef-${clip.id}-${effect.id}`;

function valuesAt(clip: EffectClip, effect: Effect, local: number, resolve: Resolve): Values {
  const base = paramValues(effect);
  return Object.fromEntries(
    EFFECTS[effect.kind].params.map((p) => {
      const track = clip.keyframes[effectKey(effect.id, p.key)];
      if (p.kind === ValueKind.Color) {
        return [p.key, track?.length ? sampleColor(track, local, resolve) : resolve(String(base[p.key]))];
      }
      return [p.key, track?.length ? sampleTrack(track, local) : Number(base[p.key])];
    })
  );
}

const active = (clip: EffectClip) => clip.effects.filter((e) => e.enabled);

function renderAt(clip: EffectClip, frame: Frame, local: number, resolve: Resolve): { effect: Effect; out: Rendered }[] {
  return active(clip).map((effect) => ({ effect, out: EFFECTS[effect.kind].render(valuesAt(clip, effect, local, resolve), { ...frame, frame: local }, filterId(clip, effect), effect.lut ?? null) }));
}

function primitives(nodes: SvgNode[]): SvgNode[] {
  return nodes.flatMap((n) => [n, ...primitives(n.children ?? [])]);
}

function markup(node: SvgNode, id: (n: SvgNode) => string | null): string {
  const own = id(node);
  const attrs = Object.entries({ ...(own ? { id: own } : {}), ...node.attrs })
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');
  return `<${node.tag}${attrs}>${(node.children ?? []).map((c) => markup(c, id)).join('')}</${node.tag}>`;
}

function filterMarkup(clip: EffectClip, effect: Effect, rendered: Rendered): string {
  const fid = filterId(clip, effect);
  return rendered.nodes
    .map((filter) => {
      const ids = new Map(primitives(filter.children ?? []).map((n, i) => [n, `${fid}-${i}`]));
      return markup(filter, (n) => ids.get(n) ?? null);
    })
    .join('');
}

export function effectLayer(clip: EffectClip, frame: Frame, resolve: Resolve, inner: string): string {
  const rendered = renderAt(clip, frame, 0, resolve);
  if (!rendered.length) {
    return inner;
  }
  const filter = rendered.map((r) => r.out.filter).join(' ');
  const defs = rendered.map((r) => filterMarkup(clip, r.effect, r.out)).join('');
  const svg = defs ? `<svg class="efd" aria-hidden="true"><defs>${defs}</defs></svg>` : '';
  return `<div class="ef" id="${layerId(clip)}" style="filter:${esc(filter)}">${svg}${inner}</div>`;
}

type Adjusting = EffectClip & { blend: string };

const UNADJUSTED = { filter: 'none', mixBlendMode: 'normal' };

function adjusting(clip: Adjusting, frame: Frame, resolve: Resolve) {
  const rendered = renderAt(clip, frame, 0, resolve);
  return { rendered, on: { filter: rendered.map((r) => r.out.filter).join(' ') || 'none', mixBlendMode: clip.blend } };
}

export function adjustmentLayer(clip: Adjusting, frame: Frame, resolve: Resolve, inner: string, zIndex: number): string {
  const { rendered, on } = adjusting(clip, frame, resolve);
  const defs = rendered.map((r) => filterMarkup(clip, r.effect, r.out)).join('');
  const svg = defs ? `<svg class="efd" aria-hidden="true"><defs>${defs}</defs></svg>` : '';
  const shown = clip.from === 0 ? on : UNADJUSTED;
  return `<div class="ef" id="${layerId(clip)}" data-clip="${esc(clip.id)}" data-group="${esc(clip.id)}" style="z-index:${zIndex};filter:${esc(shown.filter)};mix-blend-mode:${esc(shown.mixBlendMode)}">${svg}${inner}</div><!--/group:${esc(clip.id)}-->`;
}

export function adjustmentTimeline(clip: Adjusting, frame: Frame, resolve: Resolve): EffectSet[] {
  const target = `#${layerId(clip)}`;
  const { on } = adjusting(clip, frame, resolve);
  const start = clip.from > 0 ? [{ target, vars: on, at: setTime(clip.from, frame.fps) }] : [];
  return [...start, ...effectTimeline(clip, frame, resolve), { target, vars: UNADJUSTED, at: setTime(clip.from + clip.durationInFrames, frame.fps) }];
}

function animated(clip: EffectClip, resolve: Resolve): boolean {
  return active(clip).some((effect) => {
    const keyed = EFFECTS[effect.kind].params.some((p) => clip.keyframes[effectKey(effect.id, p.key)]?.length);
    return keyed || Boolean(EFFECTS[effect.kind].varies?.(valuesAt(clip, effect, 0, resolve)));
  });
}

type Snapshot = { filter: string; attrs: Map<string, Record<string, string | number>> };

function snapshot(clip: EffectClip, frame: Frame, local: number, resolve: Resolve): Snapshot {
  const rendered = renderAt(clip, frame, local, resolve);
  const attrs = new Map<string, Record<string, string | number>>();
  for (const { effect, out } of rendered) {
    for (const filter of out.nodes) {
      primitives(filter.children ?? []).forEach((n, i) => attrs.set(`#${filterId(clip, effect)}-${i}`, n.attrs));
    }
  }
  return { filter: rendered.map((r) => r.out.filter).join(' '), attrs };
}

const PRECISION = 10000;
const HALF_FRAME = 0.5;
const setTime = (frame: number, fps: number) => Math.round(((frame - HALF_FRAME) / fps) * PRECISION) / PRECISION;

export function effectTimeline(clip: EffectClip, frame: Frame, resolve: Resolve): EffectSet[] {
  if (!animated(clip, resolve)) {
    return [];
  }
  const sets: EffectSet[] = [];
  let previous = snapshot(clip, frame, 0, resolve);

  for (let local = 1; local < clip.durationInFrames; local++) {
    const next = snapshot(clip, frame, local, resolve);
    const at = setTime(clip.from + local, frame.fps);
    if (next.filter !== previous.filter) {
      sets.push({ target: `#${layerId(clip)}`, vars: { filter: next.filter }, at });
    }
    for (const [target, attrs] of next.attrs) {
      const before = previous.attrs.get(target) ?? {};
      const changed = Object.fromEntries(Object.entries(attrs).filter(([k, v]) => before[k] !== v));
      if (Object.keys(changed).length) {
        sets.push({ target, vars: { attr: changed }, at });
      }
    }
    previous = next;
  }
  return sets;
}

export function effectScript(sets: EffectSet[]): string {
  return sets.map((s) => `tl.set(${js(s.target)},${js(s.vars)},${s.at});`).join('');
}
