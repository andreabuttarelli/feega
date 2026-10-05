import type { ComponentId } from '../components';
import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { sampleTrack } from '../keyframes';
import { boxOf } from '../layout';
import { apply2d, composeLocal, mul2d, worldAt } from '../parent';
import type { Size } from '../shape/geometry';
import { charPositions } from '../text-animators/split';
import { presetCurve, shapeCurve, type Bend } from '../text-path/curves';
import { placeGlyphs, type Curve, type Placement } from '../text-path/layout';
import { FIELDS, PathPreset, PathSourceKind, TEXT_PATH_KEYS, isOn, textPathKey, type PathSource, type TextPath, type TextPathKey } from '../text-path/model';
import { SHAPE_SOURCE } from '../text-path/ops';
import { css, esc, js, px } from './html';
import { hotScope, hotSeek } from './hot';
import { lookAt } from './shapes';
import { seekDriver } from './stage';
import { Timing, placed, type Template } from './templates';
import { typeStyle } from './type-style';

export type TextPathBake = { id: string; from: number; index: number[]; curves: Curve[]; placements: Placement[] };

type Frame = { width: number; height: number };
type Values = Record<TextPathKey, number>;
type CurveArgs = { doc: MotionDoc; clip: MotionClip; frame: number; bend: Bend; box: Size };

const TEXT_PATH_TIMELINE = 'feegaTextPaths';
const BASELINE_EM = 0.8;
const WHITESPACE = /\s/;
const SIZE_DIGITS = 100;

export const TEXT_PATH_CSS = '.tg{position:absolute;left:0;top:0;white-space:pre;line-height:1;transform-origin:0 0}';

export const glyphsId = (id: string) => `tp-${id}`;

function valuesAt(clip: MotionClip, path: TextPath, frame: number): Values {
  return Object.fromEntries(
    TEXT_PATH_KEYS.map((k) => {
      const track = clip.keyframes[textPathKey(k)];
      return [k, track?.length ? sampleTrack(track, frame) : FIELDS[k].read(path)];
    })
  ) as Values;
}

const sizeOf = (props: Record<string, unknown>, frame: Frame): Size => ({ w: Number(props.width) * frame.width, h: Number(props.height) * frame.height });

function borrowed(source: string, args: CurveArgs): Curve | null {
  const shape = findClip(args.doc, source)?.clip;
  if (!shape || shape.component !== SHAPE_SOURCE) {
    return null;
  }
  const local = Math.min(Math.max(args.clip.from + args.frame - shape.from, 0), shape.durationInFrames - 1);
  return shapeCurve(lookAt(shape, local), sizeOf(shape.props, args.doc), local / args.doc.fps, args.box);
}

const SOURCE: { [K in PathSourceKind]: (source: Extract<PathSource, { kind: K }>, args: CurveArgs) => Curve | null } = {
  [PathSourceKind.Preset]: (source, args) => presetCurve(source.preset, args.bend, args.box),
  [PathSourceKind.Clip]: (source, args) => borrowed(source.clip, args)
};

function curveAt(source: PathSource, args: CurveArgs): Curve {
  const curve = (SOURCE[source.kind] as (s: PathSource, a: CurveArgs) => Curve | null)(source, args);
  return curve ?? presetCurve(PathPreset.Line, args.bend, args.box);
}

const placementOf = (v: Values): Placement => ({
  first: v.firstMargin,
  last: v.lastMargin,
  align: v.align,
  reverse: isOn(v.reverse),
  perpendicular: isOn(v.perpendicular),
  force: isOn(v.forceAlign)
});

function curveOf(doc: MotionDoc, clip: MotionClip, path: TextPath, v: Values, frame: number, box: Size): Curve {
  return curveAt(path.source, { doc, clip, frame, bend: { radius: v.radius, arc: v.arc }, box });
}

export function textPathBake(clip: MotionClip, doc: MotionDoc, frame: Frame = doc): TextPathBake {
  const path = clip.textPath!;
  const box = sizeOf(clip.props, frame);
  const curves: Curve[] = [];
  const seen = new Map<string, number>();
  const placements: Placement[] = [];
  const index: number[] = [];

  for (let f = 0; f < clip.durationInFrames; f++) {
    const v = valuesAt(clip, path, f);
    const curve = curveOf(doc, clip, path, v, f, box);
    const key = JSON.stringify(curve);
    if (!seen.has(key)) {
      seen.set(key, curves.length);
      curves.push(curve);
    }
    index.push(seen.get(key)!);
    placements.push(placementOf(v));
  }
  return { id: clip.id, from: clip.from, index, curves, placements };
}

export function textPathOutline(doc: MotionDoc, clip: MotionClip, frame: number): Curve | null {
  const path = clip.textPath;
  if (!path) {
    return null;
  }
  const local = Math.min(Math.max(frame - clip.from, 0), clip.durationInFrames - 1);
  const box = sizeOf(clip.props, doc);
  const curve = curveOf(doc, clip, path, valuesAt(clip, path, local), local, box);
  const center: [number, number] = [Number(clip.props.x) * doc.width, Number(clip.props.y) * doc.height];
  const own = composeLocal({ x: 0, y: 0, rotateZ: Number(clip.props.rotation ?? 0), scaleX: Number(clip.props.scale ?? 1), scaleY: Number(clip.props.scale ?? 1) }, center);
  const toFrame = mul2d(worldAt(doc, clip.id, frame, doc), own);
  const left = center[0] - box.w / 2;
  const top = center[1] - box.h / 2;
  return { points: curve.points.map((p) => apply2d(toFrame, [p[0] + left, p[1] + top])), closed: curve.closed };
}

export function glyphHtml(text: string, seed: number | null): string {
  const positions = charPositions(text, seed);
  let n = 0;
  return [...text].map((c) => (WHITESPACE.test(c) ? '<span class="tg"> </span>' : `<span class="tg"><span class="tu" style="--p:${positions[n++]}">${esc(c)}</span></span>`)).join('');
}

const CASE: Partial<Record<ComponentId, string>> = { Kicker: 'uppercase' };

export function textPathTemplate(component: ComponentId): Template<'Title'> {
  return {
    timing: Timing.Wrapper,
    html: (ctx) => {
      const size = Math.round(ctx.p.size * ctx.unit * SIZE_DIGITS) / SIZE_DIGITS;
      const box = boxOf(ctx.p, ctx);
      const style = css({ ...typeStyle(ctx, ctx.p, size), color: ctx.color(ctx.p.color), position: 'relative', width: px(box.width), height: px(box.height), textTransform: CASE[component], ...ctx.text.vars });
      const host = ctx.text.id ? ` id="${ctx.text.id}"` : '';
      return placed(ctx, ctx.p, `<div${host} style="${style}">${ctx.text.style}<div id="${glyphsId(ctx.id)}">${glyphHtml(ctx.p.text, ctx.text.seed)}</div></div>`);
    }
  };
}

export function textPathScript(bakes: readonly TextPathBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(TEXT_PATH_TIMELINE)}const B=${js(bakes)};const place=(${placeGlyphs.toString()});
function textPathsAt(time){
  B.forEach(function(b){
    const host=document.getElementById(${js(glyphsId(''))}+b.id);
    if(!host){return;}
    const glyphs=Array.prototype.slice.call(host.children);
    const f=Math.min(Math.max(Math.floor(time*${fps}+1e-6)-b.from,0),b.index.length-1);
    const advances=glyphs.map(function(g){return parseFloat(getComputedStyle(g).width)||0;});
    place(b.curves[b.index[f]],advances,b.placements[f]).forEach(function(p,i){glyphs[i].style.transform='translate('+p[0]+'px,'+p[1]+'px) rotate('+p[2]+'deg) translate(-50%,-${BASELINE_EM}em)';});
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(TEXT_PATH_TIMELINE, duration, 'textPathsAt')}
${hotSeek('textPathsAt')}
if(document.fonts){document.fonts.ready.then(function(){textPathsAt(tl?tl.time():0);});}
textPathsAt(0);
})();</script>`;
}
