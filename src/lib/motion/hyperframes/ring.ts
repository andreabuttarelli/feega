import type { MotionClip } from '../doc';
import { sampleTrack } from '../keyframes';
import { CardKind, RING_NUMBER_KEYS, SLICES_PER_CARD, Spin, cardAt, ringSliceId, type RingCard } from '../ring/model';
import { ringAt, type RingBake, type RingRow } from '../ring/pose';
import type { PropsOf } from './templates';
import { css, esc, js } from './html';
import { seekDriver } from './stage';
import { hotScope, hotSeek } from './hot';

type RingProps = PropsOf<'Ring'>;
type Env = { width: number; height: number; unit: number; fps: number };
type Ctx = { id: string; p: RingProps; width: number; height: number; start: number; length: number; mediaStart: number; color: (v: string) => string; asset: (id: string | null) => string | null };

const RING_TIMELINE = 'feegaRing';
const GROUP_END = (id: string) => `<!--/group:${esc(id)}-->`;

export const ringIds = {
  view: (id: string) => `rgv-${id}`,
  tilt: (id: string) => `rgt-${id}`,
  spin: (id: string) => `rgy-${id}`,
  shadow: (id: string) => `rgsh-${id}`,
  slice: (id: string, card: number, slice: number) => `rg-${id}-${card}-${slice}`
};

const SPIN_SIGN: Record<Spin, 1 | -1> = { [Spin.Left]: 1, [Spin.Right]: -1 };

const isKeyed = (clip: MotionClip) => RING_NUMBER_KEYS.some((key) => clip.keyframes[key]?.length);

function rowAt(clip: MotionClip, frame: number): RingRow {
  const p = clip.props as Record<string, number>;
  return Object.fromEntries(RING_NUMBER_KEYS.map((key) => [key, clip.keyframes[key]?.length ? sampleTrack(clip.keyframes[key], frame) : Number(p[key])])) as RingRow;
}

export function ringBake(clip: MotionClip, env: Env): RingBake {
  const p = clip.props as RingProps;
  const frames = isKeyed(clip) ? clip.durationInFrames + 1 : 1;
  return {
    id: clip.id,
    from: clip.from,
    trim: clip.trimStart,
    fps: env.fps,
    width: env.width,
    height: env.height,
    unit: env.unit,
    count: p.count,
    slices: SLICES_PER_CARD,
    loopFrames: Math.max(1, Math.round(p.loop * env.fps)),
    turns: p.turns,
    direction: SPIN_SIGN[p.direction],
    doubleSided: p.doubleSided,
    content: { width: env.width, height: env.height },
    rows: Array.from({ length: frames }, (_, f) => rowAt(clip, f))
  };
}

export function sliceChunks(content: string, ids: readonly string[]): Map<string, string> {
  const chunks = new Map<string, string>();
  let cursor = 0;
  const ends = ids.map((id) => ({ id, at: content.indexOf(GROUP_END(id)) })).filter((e) => e.at >= 0).sort((a, b) => a.at - b.at);
  for (const { id, at } of ends) {
    chunks.set(id, content.slice(cursor, at));
    cursor = at + GROUP_END(id).length;
  }
  return chunks;
}

const fill = css({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover', display: 'block' });

type Face = (ctx: Ctx, card: RingCard, at: { card: number; slice: number }, chunks: Map<string, string>) => string;

const FACES: Record<CardKind, Face> = {
  [CardKind.Image]: (ctx, card) => {
    const url = ctx.asset(card.ref);
    return url ? `<img src="${esc(url)}" alt="" crossorigin="anonymous" style="${fill}" />` : '';
  },
  [CardKind.Video]: (ctx, card, at) => {
    const url = ctx.asset(card.ref);
    const id = `${ringIds.slice(ctx.id, at.card, at.slice)}-v`;
    return url ? `<video id="${id}" src="${esc(url)}" crossorigin="anonymous" preload="auto" muted playsinline data-start="${ctx.start}" data-duration="${ctx.length}" data-media-start="${ctx.mediaStart}" style="${fill}"></video>` : '';
  },
  [CardKind.Comp]: (ctx, _card, at, chunks) => {
    const chunk = chunks.get(ringSliceId(ctx.id, at.card, at.slice)) ?? '';
    return `<div class="rgc" style="${css({ position: 'absolute', left: '0', top: '0', width: `${ctx.width}px`, height: `${ctx.height}px`, transformOrigin: '0 0' })}">${chunk}</div>`;
  }
};

export function ringHtml(ctx: Ctx, content: string): string {
  const ids = Array.from({ length: ctx.p.count }, (_, card) => Array.from({ length: SLICES_PER_CARD }, (_, slice) => ringSliceId(ctx.id, card, slice))).flat();
  const chunks = sliceChunks(content, ids);
  const sliceCss = css({ position: 'absolute', left: '0', top: '0', overflow: 'hidden', transformOrigin: '0 0', background: ctx.color(ctx.p.cardColor), backfaceVisibility: ctx.p.doubleSided ? 'visible' : 'hidden' });
  const anchor = css({ position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d' });
  const slices = Array.from({ length: ctx.p.count }, (_, card) => {
    const shown = cardAt(ctx.p.cards, card);
    return Array.from({ length: SLICES_PER_CARD }, (_, slice) => {
      const face = shown ? FACES[shown.kind](ctx, shown, { card, slice }, chunks) : '';
      return `<div id="${ringIds.slice(ctx.id, card, slice)}" class="rgs" style="${sliceCss}"><div class="rgi" style="${css({ position: 'absolute', left: '0', top: '0' })}">${face}</div></div>`;
    }).join('');
  }).join('');
  const shadow = `<div id="${ringIds.shadow(ctx.id)}" style="${css({ position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', background: 'radial-gradient(closest-side, rgba(0,0,0,1), rgba(0,0,0,0))' })}"></div>`;
  return `<div class="cc" id="${ringIds.view(ctx.id)}" style="${css({ overflow: 'hidden' })}"><div id="${ringIds.tilt(ctx.id)}" style="${css({ position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformStyle: 'preserve-3d' })}">${shadow}<div id="${ringIds.spin(ctx.id)}" style="${anchor}">${slices}</div></div></div>`;
}

export function ringScript(bakes: readonly RingBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(RING_TIMELINE)}const RG_AT=(${ringAt.toString()});
const B=${js(bakes)};
const IDS=${js(bakes.map((b) => ({ view: ringIds.view(b.id), tilt: ringIds.tilt(b.id), spin: ringIds.spin(b.id), shadow: ringIds.shadow(b.id), slices: Array.from({ length: b.count * b.slices }, (_, i) => ringIds.slice(b.id, Math.floor(i / b.slices), i % b.slices)) })))};
const items=B.map(function(b,i){const ids=IDS[i];const by=function(id){return document.getElementById(id);};return {b:b,view:by(ids.view),tilt:by(ids.tilt),spin:by(ids.spin),shadow:by(ids.shadow),slices:ids.slices.map(function(id){const el=by(id);return el&&{el:el,inner:el.firstElementChild,comp:el.querySelector('.rgc')};})};});
function ringNow(time){
  items.forEach(function(it){
    if(!it.view){return;}
    const pose=RG_AT(it.b,time*${fps});
    it.view.style.perspective=pose.perspective+'px';
    it.view.style.perspectiveOrigin=pose.origin;
    it.tilt.style.transform=pose.tilt;
    it.spin.style.transform=pose.spin;
    it.shadow.style.width=it.shadow.style.height=pose.shadow.size+'px';
    it.shadow.style.transform=pose.shadow.transform;
    it.shadow.style.opacity=pose.shadow.opacity;
    pose.slices.forEach(function(s,k){
      const slot=it.slices[k];
      if(!slot){return;}
      slot.el.style.width=s.width+'px';
      slot.el.style.height=s.height+'px';
      slot.el.style.transform=s.transform;
      slot.el.style.opacity=s.opacity;
      slot.el.style.filter=s.blur>0?'blur('+s.blur+'px)':'none';
      slot.inner.style.left=s.offset+'px';
      slot.inner.style.width=pose.card.width+'px';
      slot.inner.style.height=pose.card.height+'px';
      if(slot.comp){slot.comp.style.transform='translate('+pose.cover.x+'px,'+pose.cover.y+'px) scale('+pose.cover.scale+')';}
    });
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(RING_TIMELINE, duration, 'ringNow')}
${hotSeek('ringNow')}
ringNow(0);
})();</script>`;
}
