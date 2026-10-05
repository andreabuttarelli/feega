import type { MotionClip } from '../doc';
import { sampleTrack } from '../keyframes';
import { CellFit, bentoCellId, type BentoCard } from '../bento/model';
import { BENTO_DEFAULTS, BENTO_REFERENCE_SIDE, BentoEnter, bentoCells, bentoGrid, params, type BentoRect } from '../../canvas/composition/bento';
import { clampParams } from '../../canvas/composition/clamp';
import type { PropsOf } from './templates';
import { css, esc, js, px } from './html';
import { seekDriver } from './stage';
import { hotScope, hotSeek } from './hot';

type BentoProps = PropsOf<'Composition'>;
type Env = { width: number; height: number; fps: number };
type Ctx = Env & { id: string; p: BentoProps; start: number; length: number; mediaStart: number; color: (v: string) => string; asset: (id: string | null) => string | null };

export type BentoBake = {
  id: string;
  from: number;
  fps: number;
  scale: number;
  lift: number;
  enter: BentoEnter;
  stagger: number;
  enterFrames: number;
  cells: number;
  radius: number[];
};

export type BentoPose = { radius: number; cells: { opacity: number; transform: string; lift: number; zoom: number }[] };

const BENTO_TIMELINE = 'feegaBento';
const RADIUS_KEY = 'cornerRadius';
const LIFT_SHARE = 0.04;
const PERCENT = 100;
const GROUP_END = (id: string) => `<!--/group:${esc(id)}-->`;

export const bentoIds = {
  view: (id: string) => `btv-${id}`,
  cell: (id: string, index: number) => `bt-${id}-${index}`
};

const settings = (p: BentoProps) => clampParams(params, p.layoutParams);

function cellsOf(p: BentoProps, frame: Env) {
  const cards = p.media as BentoCard[];
  return bentoCells(bentoGrid(p.layoutParams, frame), cards, frame).map((cell) => ({ ...cell, card: cell.item === null ? null : cards[cell.item] }));
}

function radiusRows(clip: MotionClip, fallback: number): number[] {
  const track = clip.keyframes[RADIUS_KEY];
  if (!track?.length) {
    return [fallback];
  }
  return Array.from({ length: clip.durationInFrames + 1 }, (_, f) => sampleTrack(track, f));
}

export function bentoBake(clip: MotionClip, env: Env): BentoBake {
  const p = clip.props as BentoProps;
  const v = settings(p);
  const scale = Math.min(env.width, env.height) / BENTO_REFERENCE_SIDE;
  return {
    id: clip.id,
    from: clip.from,
    fps: env.fps,
    scale,
    lift: Math.min(env.width, env.height) * LIFT_SHARE,
    enter: v.enter as BentoEnter,
    stagger: Math.round(Number(v.stagger) * env.fps),
    enterFrames: Math.max(1, Math.round(Number(v.enterSeconds) * env.fps)),
    cells: cellsOf(p, env).length,
    radius: radiusRows(clip, Number(v.cornerRadius))
  };
}

export function bentoAt(bake: BentoBake, frame: number): BentoPose {
  const PRECISION = 1000;
  const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
  const clipFrame = Math.max(0, Math.floor(frame - bake.from));
  const radius = round(bake.radius[Math.min(clipFrame, bake.radius.length - 1)] * bake.scale);
  const eased = (t: number) => 1 - (1 - t) ** 3;
  const moves: Record<string, (p: number) => { lift: number; zoom: number }> = {
    none: () => ({ lift: 0, zoom: 1 }),
    fade: () => ({ lift: 0, zoom: 1 }),
    rise: (p) => ({ lift: round((1 - p) * bake.lift), zoom: 1 }),
    scale: (p) => ({ lift: 0, zoom: round(0.9 + 0.1 * p) })
  };
  const css = (m: { lift: number; zoom: number }) => (m.lift ? `translateY(${m.lift}px)` : m.zoom !== 1 ? `scale(${m.zoom})` : 'none');

  const cells = Array.from({ length: bake.cells }, (_, i) => {
    const progress = bake.enter === 'none' ? 1 : eased(Math.min(1, Math.max(0, (clipFrame - i * bake.stagger) / bake.enterFrames)));
    const move = progress >= 1 ? moves.none(1) : moves[bake.enter](progress);
    return { opacity: round(progress), transform: css(move), ...move };
  });
  return { radius, cells };
}

export type BentoSlot = { cell: BentoRect; content: { x: number; y: number; scale: number } };
type Point = { x: number; y: number };

function contentOffset(card: BentoCard, rect: BentoRect, env: Env) {
  const s = FRAME_SCALE[fitOf(card)](rect.width / env.width, rect.height / env.height);
  const focus = focusOf(card);
  return { x: (rect.width - env.width * s) * focus.x, y: (rect.height - env.height * s) * focus.y, scale: s };
}

export function bentoSlotAt(clip: MotionClip, env: Env, item: number, frame: number): BentoSlot | null {
  const p = clip.props as BentoProps;
  const cells = cellsOf(p, env);
  const index = cells.findIndex((c) => c.item === item);
  const card = cells[index]?.card;
  if (!card) {
    return null;
  }
  const { rect } = cells[index];
  const pose = bentoAt(bentoBake(clip, env), frame).cells[index];
  const offset = contentOffset(card, rect, env);
  const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  return {
    cell: rect,
    content: {
      x: centre.x + pose.zoom * (rect.left + offset.x - centre.x),
      y: centre.y + pose.zoom * (rect.top + offset.y - centre.y) + pose.lift,
      scale: pose.zoom * offset.scale
    }
  };
}

export function slotLocal(slot: BentoSlot, point: Point): Point {
  const PRECISION = 1000;
  const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
  return { x: round((point.x - slot.content.x) / slot.content.scale), y: round((point.y - slot.content.y) / slot.content.scale) };
}

const fill = (fit: CellFit, focus: { x: number; y: number }) =>
  css({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: fit, objectPosition: `${focus.x * PERCENT}% ${focus.y * PERCENT}%`, display: 'block' });

type Face = (ctx: Ctx, card: BentoCard, at: { item: number; rect: BentoRect }, chunks: Map<string, string>) => string;

const focusOf = (card: BentoCard) => ({ x: card.focusX ?? 0.5, y: card.focusY ?? 0.5 });
const fitOf = (card: BentoCard) => card.fit ?? CellFit.Cover;

const FRAME_SCALE: Record<CellFit, (a: number, b: number) => number> = {
  [CellFit.Cover]: Math.max,
  [CellFit.Contain]: Math.min
};

function framed(ctx: Ctx, card: BentoCard, rect: BentoRect, chunk: string): string {
  const o = contentOffset(card, rect, ctx);
  return `<div class="btc" style="${css({ position: 'absolute', left: '0', top: '0', width: px(ctx.width), height: px(ctx.height), transformOrigin: '0 0', transform: `translate(${px(o.x)},${px(o.y)}) scale(${Math.round(o.scale * 10000) / 10000})` })}">${chunk}</div>`;
}

const FACES: Record<BentoCard['kind'], Face> = {
  image: (ctx, card) => {
    const url = ctx.asset(card.assetId);
    return url ? `<img src="${esc(url)}" alt="" crossorigin="anonymous" style="${fill(fitOf(card), focusOf(card))}" />` : '';
  },
  video: (ctx, card, at) => {
    const url = ctx.asset(card.assetId);
    return url
      ? `<video id="${bentoIds.cell(ctx.id, at.item)}-v" src="${esc(url)}" crossorigin="anonymous" preload="auto" muted playsinline data-start="${ctx.start}" data-duration="${ctx.length}" data-media-start="${ctx.mediaStart}" style="${fill(fitOf(card), focusOf(card))}"></video>`
      : '';
  },
  comp: (ctx, card, at, chunks) => framed(ctx, card, at.rect, chunks.get(bentoCellId(ctx.id, at.item)) ?? '')
};

function chunksOf(content: string, ids: readonly string[]): Map<string, string> {
  const chunks = new Map<string, string>();
  let cursor = 0;
  const ends = ids.map((id) => ({ id, at: content.indexOf(GROUP_END(id)) })).filter((e) => e.at >= 0).sort((a, b) => a.at - b.at);
  for (const { id, at } of ends) {
    chunks.set(id, content.slice(cursor, at));
    cursor = at + GROUP_END(id).length;
  }
  return chunks;
}

export function bentoHtml(ctx: Ctx, content: string): string {
  const v = settings(ctx.p);
  const cells = cellsOf(ctx.p, ctx);
  const chunks = chunksOf(content, (ctx.p.media as BentoCard[]).map((_, item) => bentoCellId(ctx.id, item)));
  const radius = px(Number(v.cornerRadius) * (Math.min(ctx.width, ctx.height) / BENTO_REFERENCE_SIDE));
  const body = cells
    .map(({ rect, card, item }, index) => {
      const face = card && item !== null ? FACES[card.kind](ctx, card, { item, rect }, chunks) : '';
      const style = css({
        position: 'absolute',
        left: px(rect.left),
        top: px(rect.top),
        width: px(rect.width),
        height: px(rect.height),
        overflow: 'hidden',
        borderRadius: radius,
        background: ctx.color(card?.background ?? String(v.cellColor ?? BENTO_DEFAULTS.cellColor))
      });
      return `<div id="${bentoIds.cell(ctx.id, index)}" class="btx" style="${style}">${face}</div>`;
    })
    .join('');
  return `<div class="cc" id="${bentoIds.view(ctx.id)}" style="${css({ position: 'absolute', inset: '0', overflow: 'hidden', background: ctx.color(ctx.p.background) })}">${body}</div>`;
}

export function bentoScript(bakes: readonly BentoBake[], duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(BENTO_TIMELINE)}const BT_AT=(${bentoAt.toString()});
const B=${js(bakes)};
const IDS=${js(bakes.map((b) => Array.from({ length: b.cells }, (_, i) => bentoIds.cell(b.id, i))))};
const items=B.map(function(b,k){return {b:b,cells:IDS[k].map(function(id){return document.getElementById(id);})};});
function bentoNow(time){
  items.forEach(function(it){
    const pose=BT_AT(it.b,time*it.b.fps);
    it.cells.forEach(function(el,i){
      if(!el){return;}
      el.style.borderRadius=pose.radius+'px';
      el.style.opacity=pose.cells[i].opacity;
      el.style.transform=pose.cells[i].transform;
    });
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(BENTO_TIMELINE, duration, 'bentoNow')}
${hotSeek('bentoNow')}
bentoNow(0);
})();</script>`;
}
